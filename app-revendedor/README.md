# Nexora Revendedor APK

Projeto separado para gerar o APK dos revendedores.

## Comandos

```powershell
cd C:\iptv-panel\app-revendedor

npm install

npx eas login

npx eas build:configure

npx eas build -p android --profile preview
```

O APK gerado será o app exclusivo para revendedores.
