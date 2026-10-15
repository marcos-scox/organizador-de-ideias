package com.marcosdev.organizadordeideias;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONException;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "BackupFolder")
public class BackupFolderPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final long MAX_BACKUP_BYTES = 100L * 1024L * 1024L;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
            | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("Nenhuma pasta foi selecionada.");
            return;
        }
        Uri uri = result.getData().getData();
        int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, flags);
        } catch (Exception ignored) {
            // Alguns provedores não oferecem permissão persistente; o URI ainda funciona nesta sessão.
        }
        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("name", folderName(uri));
        call.resolve(ret);
    }

    @PluginMethod
    public void listBackups(PluginCall call) {
        final Uri tree = treeUri(call);
        if (tree == null) return;
        executor.execute(() -> {
            try {
                JSONArray files = new JSONArray();
                Uri backupDir = backupDirectory(tree, false);
                if (backupDir == null) { JSObject empty = new JSObject(); empty.put("files", new JSONArray()); call.resolve(empty); return; }
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(backupDir));
                String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE, DocumentsContract.Document.COLUMN_LAST_MODIFIED};
                try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null)) {
                    if (cursor != null) while (cursor.moveToNext()) {
                        String name = cursor.getString(1);
                        String mime = cursor.getString(2);
                        if (name == null || !name.toLowerCase().endsWith(".zip") || DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) continue;
                        JSObject item = new JSObject();
                        item.put("name", name);
                        item.put("size", cursor.isNull(3) ? 0 : cursor.getLong(3));
                        item.put("lastModified", cursor.isNull(4) ? 0 : cursor.getLong(4));
                        files.put(item);
                    }
                }
                JSObject ret = new JSObject(); ret.put("files", files); call.resolve(ret);
            } catch (Exception e) { call.reject("Não foi possível listar os backups.", e); }
        });
    }

    @PluginMethod
    public void writeBackup(PluginCall call) {
        final Uri tree = treeUri(call);
        final String name = call.getString("name");
        final String data = call.getString("data");
        if (tree == null) return;
        if (!validName(name) || data == null) { call.reject("Nome ou conteúdo de backup inválido."); return; }
        executor.execute(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                if (bytes.length > MAX_BACKUP_BYTES) throw new IllegalArgumentException("O backup excede 100 MB.");
                Uri root = backupDirectory(tree, true), existing = findChild(tree, root, name);
                if (existing != null) DocumentsContract.deleteDocument(getContext().getContentResolver(), existing);
                Uri target = DocumentsContract.createDocument(getContext().getContentResolver(), root, "application/zip", name);
                if (target == null) throw new IllegalStateException("O provedor não conseguiu criar o arquivo.");
                try (OutputStream out = getContext().getContentResolver().openOutputStream(target, "w")) {
                    if (out == null) throw new IllegalStateException("Não foi possível abrir o arquivo para gravação.");
                    out.write(bytes); out.flush();
                }
                JSObject ret = new JSObject(); ret.put("success", true); ret.put("name", name); call.resolve(ret);
            } catch (Exception e) { call.reject("Falha ao salvar o backup na pasta escolhida.", e); }
        });
    }

    @PluginMethod
    public void readBackup(PluginCall call) {
        final Uri tree = treeUri(call);
        final String name = call.getString("name");
        if (tree == null) return;
        if (!validName(name)) { call.reject("Nome de arquivo inválido."); return; }
        executor.execute(() -> {
            try {
                Uri dir = backupDirectory(tree, false), file = dir == null ? null : findChild(tree, dir, name);
                if (file == null) throw new IllegalStateException("Arquivo não encontrado.");
                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                try (InputStream in = getContext().getContentResolver().openInputStream(file)) {
                    if (in == null) throw new IllegalStateException("Não foi possível ler o arquivo.");
                    byte[] chunk = new byte[8192]; int count; long total = 0;
                    while ((count = in.read(chunk)) != -1) { total += count; if (total > MAX_BACKUP_BYTES) throw new IllegalArgumentException("O backup excede 100 MB."); buffer.write(chunk, 0, count); }
                }
                JSObject ret = new JSObject(); ret.put("data", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP)); call.resolve(ret);
            } catch (Exception e) { call.reject("Não foi possível ler esse backup.", e); }
        });
    }

    @PluginMethod
    public void deleteBackup(PluginCall call) {
        final Uri tree = treeUri(call);
        final String name = call.getString("name");
        if (tree == null) return;
        if (!validName(name)) { call.reject("Nome de arquivo inválido."); return; }
        executor.execute(() -> {
            try {
                Uri dir = backupDirectory(tree, false), file = dir == null ? null : findChild(tree, dir, name);
                if (file != null) DocumentsContract.deleteDocument(getContext().getContentResolver(), file);
                JSObject ret = new JSObject(); ret.put("success", true); call.resolve(ret);
            } catch (Exception e) { call.reject("Não foi possível excluir esse backup.", e); }
        });
    }

    @Nullable
    private Uri treeUri(PluginCall call) {
        String value = call.getString("treeUri");
        if (value == null || value.isEmpty()) { call.reject("Nenhuma pasta de backup está vinculada."); return null; }
        try { return Uri.parse(value); } catch (Exception e) { call.reject("A pasta selecionada não é válida.", e); return null; }
    }

    private Uri rootDocument(Uri tree) {
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }

    @Nullable
    private Uri backupDirectory(Uri tree, boolean create) throws Exception {
        Uri root = rootDocument(tree);
        Uri dir = findChild(tree, root, "backups");
        if (dir == null && create) dir = DocumentsContract.createDocument(getContext().getContentResolver(), root, DocumentsContract.Document.MIME_TYPE_DIR, "backups");
        return dir;
    }

    @Nullable
    private Uri findChild(Uri tree, String name) throws Exception {
        return findChild(tree, rootDocument(tree), name);
    }

    @Nullable
    private Uri findChild(Uri tree, Uri parent, String name) throws Exception {
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getDocumentId(parent));
        String[] columns = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME};
        try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null)) {
            if (cursor != null) while (cursor.moveToNext()) {
                if (name.equals(cursor.getString(1))) return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(0));
            }
        }
        return null;
    }

    private String folderName(Uri tree) {
        try (Cursor cursor = getContext().getContentResolver().query(rootDocument(tree), new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) return cursor.getString(0);
        } catch (Exception ignored) {}
        return "Pasta Android selecionada";
    }

    private boolean validName(String name) {
        return name != null && name.matches("[A-Za-z0-9._-]{1,160}") && name.toLowerCase().endsWith(".zip");
    }
}
