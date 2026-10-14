package com.isp.libretaherramientas;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Descarga la APK nueva dentro de la app y abre el instalador de Android
 * ("¿Deseas actualizar esta aplicación?"), sin pasar por el navegador.
 */
@CapacitorPlugin(name = "Actualizador")
public class Actualizador extends Plugin {

    private File archivoApk() {
        File carpeta = new File(getContext().getCacheDir(), "actualizacion");
        carpeta.mkdirs();
        return new File(carpeta, "LibretaISP.apk");
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("Falta la dirección de la APK");
            return;
        }
        new Thread(() -> {
            File destino = archivoApk();
            File temporal = new File(destino.getPath() + ".parcial");
            HttpURLConnection con = null;
            try {
                con = (HttpURLConnection) new URL(url).openConnection();
                con.setConnectTimeout(15000);
                con.setReadTimeout(30000);
                if (con.getResponseCode() != 200) {
                    call.reject("El servidor respondió " + con.getResponseCode());
                    return;
                }
                long total = con.getContentLengthLong();
                long leidos = 0;
                int ultimo = -1;
                byte[] buffer = new byte[64 * 1024];
                try (InputStream in = con.getInputStream(); OutputStream out = new FileOutputStream(temporal)) {
                    int n;
                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        leidos += n;
                        if (total > 0) {
                            int pct = (int) (leidos * 100 / total);
                            if (pct != ultimo) {
                                ultimo = pct;
                                JSObject p = new JSObject();
                                p.put("porcentaje", pct);
                                notifyListeners("progreso", p);
                            }
                        }
                    }
                }
                if (destino.exists()) destino.delete();
                if (!temporal.renameTo(destino)) {
                    call.reject("No se pudo guardar la APK");
                    return;
                }
                call.resolve();
            } catch (Exception e) {
                temporal.delete();
                call.reject("No se pudo descargar la actualización", e);
            } finally {
                if (con != null) con.disconnect();
            }
        }).start();
    }

    /** Abre el instalador. Si Android aún no deja instalar desde esta app, abre ese permiso y devuelve permiso=false. */
    @PluginMethod
    public void instalar(PluginCall call) {
        File apk = archivoApk();
        if (!apk.exists()) {
            call.reject("La actualización no está descargada");
            return;
        }
        JSObject r = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent permiso = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            permiso.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(permiso);
            r.put("permiso", false);
            call.resolve(r);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        r.put("permiso", true);
        call.resolve(r);
    }
}
