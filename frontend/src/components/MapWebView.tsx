import React from 'react';
import { Platform, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  html: string;
  onMessage?: (data: any) => void;
  style?: any;
}

export function MapWebView({ html, onMessage, style }: Props) {
  if (Platform.OS === 'web') {
    // use iframe with srcDoc; handle messages via window.postMessage
    React.useEffect(() => {
      const handler = (e: MessageEvent) => {
        try {
          const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (d && d.__vm_map && onMessage) onMessage(d.payload);
        } catch {}
      };
      window.addEventListener('message', handler);
      return () => window.removeEventListener('message', handler);
    }, [onMessage]);
    return (
      <View style={[{ flex: 1 }, style]}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          srcDoc={html}
          style={{ border: 0, width: '100%', height: '100%' }}
          title="map"
        />
      </View>
    );
  }
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html }}
      style={style}
      javaScriptEnabled
      domStorageEnabled
      onMessage={(e) => {
        try {
          const d = JSON.parse(e.nativeEvent.data);
          if (onMessage) onMessage(d);
        } catch {}
      }}
    />
  );
}
