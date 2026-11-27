# Trilha — app mobile (Expo / React Native)

App nativo para iOS e Android, feito com **Expo SDK 58** + **Expo Router**. Reaproveita do app web (pasta `../src`) toda a lógica: modelo de dados, agendador, recalibração, motor de sugestões, camada de IA e o store. Só as telas são nativas.

## Testar no celular (Expo Go)

1. Instale o **Expo Go** no celular (App Store / Play Store).
2. No computador:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
3. Escaneie o QR code que aparece no terminal:
   - **Android:** pelo próprio Expo Go.
   - **iPhone:** pela câmera do iOS.

O celular e o computador precisam estar **na mesma rede Wi-Fi**. Se não estiverem, ou se a rede bloquear (Wi-Fi corporativo/faculdade), use o túnel:

```bash
npx expo start --tunnel
```

> O Expo Go precisa suportar o SDK 58. Se ele avisar que o projeto usa outro SDK, atualize o Expo Go na loja.

## Estrutura

```
mobile/
  src/app/                 rotas (Expo Router)
    _layout.tsx            providers (store, tema, toasts) + stack
    (tabs)/                Hoje · Roadmaps · Sugestões IA · Perfil
    roadmap/[id].tsx       trilha com fases desbloqueáveis e modo edição
    generator.tsx          gerador de roadmap em 4 passos (modal)
  src/features/            TaskRow, editores, recalibração, card de sugestão
  src/ui/                  UI kit nativo (Button 3D, Sheet, Checkbox animado, Progress…)
  src/theme/               tokens dark/light (os mesmos do web)
  src/lib/storage.ts       AsyncStorage → AppRepository compartilhado
  metro.config.js          resolve "@/..." para ../src (código compartilhado)
```

`@/...` aponta para `../src` (código compartilhado) e `~/...` aponta para `mobile/src`.

## IA

Copie `.env.example` para `.env` e preencha `EXPO_PUBLIC_*`, ou configure em **Perfil → Integração de IA**. Sem chave configurada, o app usa o **Mock Inteligente**. Variáveis `EXPO_PUBLIC_*` ficam embutidas no app, então em produção use `EXPO_PUBLIC_AI_PROXY_URL` apontando para um backend que guarde as chaves.

## Comandos

```bash
npm run typecheck     # tsc
npm run lint          # expo lint
npx expo start --web  # roda no navegador (útil para depurar)
```

Só são usados módulos que já vêm no Expo Go (safe-area, screens, svg, async-storage, haptics). Por isso não precisa de development build.
