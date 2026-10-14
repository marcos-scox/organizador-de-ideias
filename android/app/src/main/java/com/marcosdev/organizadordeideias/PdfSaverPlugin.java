package com.marcosdev.organizadordeideias;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;

import java.io.OutputStream;

@CapacitorPlugin(name = "PdfSaver")
public class PdfSaverPlugin extends Plugin {
    private static final String PICK_DIRECTORY_CALLBACK = "pickDirectoryResult";

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, PICK_DIRECTORY_CALLBACK);
    }

    @ActivityCallback
    private void pickDirectoryResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null
                || result.getData().getData() == null) {
            call.reject("cancelled");
            return;
        }
        Uri directory = result.getData().getData();
        try {
            int flags = result.getData().getFlags()
                    & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            getContext().getContentResolver().takePersistableUriPermission(directory, flags);
        } catch (Exception ignored) {
            // Alguns provedores não permitem persistir a permissão, mas ainda aceitam a gravação atual.
        }
        JSObject ret = new JSObject();
        ret.put("uri", directory.toString());
        call.resolve(ret);
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        String directoryUri = call.getString("directoryUri");
        String filename = call.getString("filename", "organizador-de-ideias.pdf");
        String base64 = call.getString("base64");
        if (directoryUri == null || base64 == null) {
            call.reject("Destino ou arquivo ausente");
            return;
        }
        try {
            ContentResolver resolver = getContext().getContentResolver();
            Uri directory = Uri.parse(directoryUri);
            Uri file = DocumentsContract.createDocument(resolver, directory, "application/pdf", filename);
            if (file == null) throw new IllegalStateException("Não foi possível criar o arquivo");
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            try (OutputStream out = resolver.openOutputStream(file, "w")) {
                if (out == null) throw new IllegalStateException("Não foi possível abrir o arquivo");
                out.write(bytes);
                out.flush();
            }
            JSObject ret = new JSObject();
            ret.put("uri", file.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Não foi possível salvar o PDF", e);
        }
    }
}
