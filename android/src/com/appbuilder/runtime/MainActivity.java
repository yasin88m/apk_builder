package com.appbuilder.runtime;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.widget.Toast;
import java.io.InputStream;
import java.io.ByteArrayInputStream;
import java.util.HashMap;

/** Local, packaged app UI. No remote website, JS/native bridge or Internet permission. */
public class MainActivity extends Activity {
    private WebView view;
    private static final String HOST = "appassets.androidplatform.net";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(20, 19, 30));
        getWindow().setNavigationBarColor(Color.rgb(20, 19, 30));
        view = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        view.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView w, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return denied();
                String path = uri.getPath();
                if (path == null || path.contains("..") || !path.startsWith("/assets/")) return denied();
                String filename = path.substring(8);
                if (filename.isEmpty()) filename = "index.html";
                String type = filename.endsWith(".js") ? "text/javascript" : filename.endsWith(".css") ? "text/css" : filename.endsWith(".json") ? "application/json" : filename.endsWith(".png") ? "image/png" : "text/html";
                try {
                    InputStream input = getAssets().open(filename);
                    HashMap<String, String> headers = new HashMap<>();
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Cache-Control", "no-store");
                    return new WebResourceResponse(type, "UTF-8", 200, "OK", headers, input);
                } catch (Exception e) { return denied(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost()) && "https".equals(uri.getScheme())) return false;
                String scheme = uri.getScheme();
                if ("tel".equals(scheme) || "mailto".equals(scheme) || "https".equals(scheme) || "http".equals(scheme)) {
                    try { startActivity(new Intent("tel".equals(scheme) ? Intent.ACTION_DIAL : Intent.ACTION_VIEW, uri)); }
                    catch (Exception e) { Toast.makeText(MainActivity.this, "برنامه مناسب برای باز کردن این لینک پیدا نشد.", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
        });
        setContentView(view);
        view.loadUrl("https://" + HOST + "/assets/index.html");
    }
    private static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }
    @Override public void onBackPressed() { if (view.canGoBack()) view.goBack(); else super.onBackPressed(); }
    @Override public void onDestroy() { if (view != null) { view.stopLoading(); view.destroy(); } super.onDestroy(); }
}
