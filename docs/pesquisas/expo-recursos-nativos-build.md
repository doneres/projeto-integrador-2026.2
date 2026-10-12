# Pesquisa: recursos nativos e build de APK no Expo

> Issue: #24 · Alimenta a decisão "Stack complementar do mobile"
> Pesquisa feita em **2026-10-12**. Todas as fontes foram consultadas nessa data, salvo indicação. Versões de pacotes conferidas direto no registry do npm (`registry.npmjs.org`) na mesma data. Expo, Google e a OSMF mudam regras com frequência: **reconfirmar antes de fechar a decisão**.

## Pergunta

Como o **Expo (SDK atual)** lida com os recursos nativos do AXIS (mapa, GPS para check-in, câmera para auditoria de PDV, coordenadas na prospecção e CEP no cadastro de cliente) e com a distribuição em **APK** (RNF09: Android 8.0 / API 26+, instalável e testado em aparelho físico), para um time de 3 estudantes sem orçamento?

---

## 0. Qual é o SDK atual

| Item | Valor em 2026-10-12 | Fonte |
|---|---|---|
| SDK estável (`latest`) | **Expo SDK 57**, `expo@57.0.28`, React Native **0.86**, React 19.2. Lançado em **30/06/2026** | <https://docs.expo.dev/versions/latest/> · <https://expo.dev/changelog/sdk-57> · `npm view expo dist-tags` |
| Próximo SDK | **SDK 58 em beta** desde **15/09/2026** (`expo@next` = 58.0.7), sobre React Native 0.88 **RC**. "Beta [...] will last three to four weeks"; a versão estável sai "shortly after" o RN 0.88 estável. Sem data fixa | <https://expo.dev/changelog/sdk-58-beta> |
| Android mínimo | SDK 54 a 57: **"Android 7+"**; `compileSdkVersion`/`targetSdkVersion` 36 | <https://docs.expo.dev/versions/latest/> |
| `minSdkVersion` padrão | **24** (Android 7.0) — default no plugin Gradle do Expo: `getVersionOrDefault("minSdk", "24")` | [`ExpoRootProjectPlugin.kt` (branch `sdk-57`)](https://github.com/expo/expo/blob/sdk-57/packages/expo-modules-autolinking/android/expo-gradle-plugin/expo-autolinking-plugin/src/main/kotlin/expo/modules/plugin/ExpoRootProjectPlugin.kt) |

**Conclusão para o RNF09:** minSdk 24 < API 26, então o APK instala em Android 8.0+ sem configuração extra. Se quisermos que o build *recuse* versões abaixo de 8.0 (para alinhar ao requisito), dá para subir com `expo-build-properties` → `android.minSdkVersion: 26` (a opção existe: "Override the default `minSdkVersion` version number in build.gradle" — <https://docs.expo.dev/versions/latest/sdk/build-properties/>). Não é obrigatório.

**Sobre o SDK 58:** o changelog diz que, quando o 58 ficar estável, as versões de Expo Go da App Store/Google Play passam para o SDK 58 e **"drop SDK 57 support"** (<https://expo.dev/changelog/sdk-58-beta>). Isso pode cair perto da demo (09–13/11/2026). Com **development build** isso não afeta o time (ver seção 4).

Versões conferidas no npm em 2026-10-12 (tag `latest` = SDK 57):

| Pacote | `latest` | Observação |
|---|---|---|
| `expo-location` | 57.0.21 | |
| `expo-camera` | 57.0.6 | |
| `expo-image-picker` | 57.0.20 | |
| `expo-image-manipulator` | 57.0.21 | |
| `expo-file-system` | 57.0.7 | |
| `expo-maps` | 57.0.4 | alpha |
| `react-native-maps` | 1.29.11 (publicado 27/09/2026) | |
| `@maplibre/maplibre-react-native` | 11.5.0 (publicado 04/10/2026) | |
| `eas-cli` | 24.13.0 | |

---

## 1. Mapa (lista/mapa de rota, mapa de clientes)

### 1.1 `react-native-maps`

- **Expo Go:** "Included in Expo Go" — funciona no Expo Go sem configurar nada para teste. <https://docs.expo.dev/versions/latest/sdk/map-view/>
- **APK/build próprio no Android exige chave do Google Maps.** Passos documentados pela Expo: criar projeto no Google Cloud, habilitar **Maps SDK for Android**, criar chave restrita ao *package name* + **SHA-1** do certificado, colocar a chave no config plugin do `react-native-maps` (`androidGoogleMapsApiKey` no `app.json`) e **rebuildar o binário**. O SHA-1 do build de desenvolvimento/EAS fica em *Credentials > Android Keystore* no dashboard da Expo. <https://docs.expo.dev/versions/latest/sdk/map-view/>
- No Android o provider é o Google Maps; o README do projeto manda, quando o mapa fica em branco, "Make sure you have enabled Google Maps API in Google developer console". <https://github.com/react-native-maps/react-native-maps>
- **New Architecture:** a partir da 1.26.1 exige RN ≥ 0.81.1 (compatível com SDK 57 / RN 0.86). <https://github.com/react-native-maps/react-native-maps>
- **Tiles OSM:** existe `UrlTile` (template de URL de tiles; o exemplo do README usa OpenStreetMap). No Android, `LocalTile` "is still just overlay over original map tiles" — ou seja, o mapa base do Google continua por baixo, a menos que se use `mapType="none"`. <https://github.com/react-native-maps/react-native-maps>

### 1.2 Custo do Google Maps no Android (o ponto que mais preocupa sem orçamento)

- **Uso mobile é ilimitado e sem cobrança:** "All mobile usage of the Maps SDK for Android is unlimited, but you can set quota limits on Dynamic Street View requests." O SKU "Maps SDK" aparece com cap gratuito "Unlimited". <https://developers.google.com/maps/documentation/android-sdk/usage-and-billing> · <https://developers.google.com/maps/billing-and-pricing/pricing> (ambas "Last updated 2026-10-08")
- **Mas exige billing account:** "you must enable billing" em cada projeto; "you must set up a billing account to set up a Cloud project". <https://developers.google.com/maps/documentation/android-sdk/usage-and-billing> · <https://developers.google.com/maps/get-started>. Na prática, isso significa cadastrar uma forma de pagamento (a página não diz "cartão" literalmente — **confirmar ao criar a conta**). Há trial de US$ 300 / 90 dias para clientes novos elegíveis. <https://developers.google.com/maps/get-started>
- Street View dinâmico é SKU Pro (cobrado) — não precisamos.
- **Navegação até o cliente sem API paga:** abrir o app do Google Maps via **Maps URLs** (`https://www.google.com/maps/dir/?api=1&destination=LAT%2CLNG&travelmode=driving`). "You don't need a Google API key to use Maps URLs." No Android abre o app se instalado, senão o navegador. <https://developers.google.com/maps/documentation/urls/get-started>. Isso evita Directions API (cobrada) — o mapa de rota no app pode ser só marcadores + ordem da lista, e o "ir até lá" fica com o Google Maps.

### 1.3 `expo-maps`

- Status: **alpha** — "This library is currently in alpha and will frequently experience breaking changes." <https://docs.expo.dev/versions/latest/sdk/maps/>
- **Não funciona no Expo Go** ("It is not available in the Expo Go app") — exige development build.
- Android = Google Maps (exige a mesma chave, em `android.config.googleMaps.apiKey`); iOS = Apple Maps.
- **Não recomendado** para o AXIS: alpha + mesma exigência de chave Google, sem ganho sobre o `react-native-maps`.

### 1.4 MapLibre React Native (alternativa sem Google)

- Pacote `@maplibre/maplibre-react-native` 11.5.0. "From v11 onwards only the new architecture is supported"; RN ≥ 0.80. <https://maplibre.org/maplibre-react-native/docs/setup/getting-started>
- Expo: `npx expo install @maplibre/maplibre-react-native` + `"plugins": ["@maplibre/maplibre-react-native"]`; **"This package can't be used with 'Expo Go'"** — exige rebuild (development build). <https://maplibre.org/maplibre-react-native/docs/setup/expo>
- Não usa chave do Google, mas **precisa de um provedor de tiles/estilo**. Se for o tile server público da OSM, valem as regras abaixo.

### 1.5 Política de uso dos tiles da OpenStreetMap (`tile.openstreetmap.org`)

Fonte: <https://operations.osmfoundation.org/policies/tiles/>

- Atribuição obrigatória e visível no mapa ("typically bottom-right"), não escondida atrás de toggles.
- **User-Agent único que identifique o app**; defaults de bibliotecas "will be blocked".
- **Proibido prefetch/bulk e uso offline** ("Offline use is not permitted on tile.openstreetmap.org").
- Respeitar headers de cache (ou cachear ≥ 7 dias).
- "No SLA or guarantee"; podem bloquear "without notice". Serviços comerciais: "access may be withdrawn at any point".

Para um projeto acadêmico com ~5 usuários isso é aceitável, mas sem garantia — é um risco para o dia da apresentação.

### 1.6 Resumo mapa

| Opção | Expo Go | Build próprio Android | Custo/conta | Risco |
|---|---|---|---|---|
| `react-native-maps` (Google) | Sim | Chave Google + SHA-1 | Grátis (uso mobile ilimitado), **exige billing account** | Baixo técnico; burocracia de conta Google Cloud |
| `react-native-maps` + `UrlTile` OSM | Sim | Ainda inicializa Google Maps no Android | Idem acima | Não elimina a chave |
| `expo-maps` | **Não** | Chave Google | Idem | Alpha, breaking changes |
| MapLibre RN + tiles OSM | **Não** | Só config plugin | Zero | Política OSM, sem SLA; API diferente |

---

## 2. Geolocalização (check-in e prospecção) — `expo-location`

Fonte principal: <https://docs.expo.dev/versions/latest/sdk/location/> e código em <https://github.com/expo/expo/tree/sdk-57/packages/expo-location>.

- **Expo Go:** "Included in Expo Go" (serviços em foreground/background no Android **não**; não precisamos de background).
- **Permissão:** `requestForegroundPermissionsAsync()` — "Asks the user to grant permissions for location while the app is in the foreground". Android usa `ACCESS_COARSE_LOCATION` (aproximada) e `ACCESS_FINE_LOCATION` (precisa). O resultado traz `android.accuracy: 'fine' | 'coarse' | 'none'`. **Se o usuário der só "aproximada", o check-in por raio de 30–150 m não é confiável** — o app precisa detectar `coarse` e pedir a precisa.
- **Opções de precisão (`Accuracy`):** `Lowest` (~3 km), `Low` (~1 km), `Balanced` ("within one hundred meters", **é o default** de `getCurrentPositionAsync`), `High` ("within ten meters"), `Highest`, `BestForNavigation`. **Para check-in usar `High` ou `Highest`, nunca o default.**
- **`coords.accuracy`:** "The radius of uncertainty for the location, measured in meters." É o número a comparar com o raio do geofence.
- **`mocked`** (Android only): "Whether the location coordinates is mocked or not." No código nativo é `location.isFromMockProvider` ([`LocationResults.kt`](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/android/src/main/java/expo/modules/location/records/LocationResults.kt)). Esse método do Android está **deprecated desde API 31** ("Prefer isMock() instead") mas continua funcionando; ambos indicam localização vinda de um *test location provider* — isto é, apps de "fake GPS" configurados nas opções de desenvolvedor. <https://developer.android.com/reference/android/location/Location>. **Não pega spoofing com root/Xposed**; é um sinal, não uma prova. iOS não tem o campo.
- **Timeout:** `getCurrentPositionAsync` **não tem opção de timeout** no JS. No Android a implementação usa `FusedLocationProviderClient.getCurrentLocation` com `CurrentLocationRequest` sem `setDurationMillis` ([`LocationHelpers.kt`](https://github.com/expo/expo/blob/sdk-57/packages/expo-location/android/src/main/java/expo/modules/location/LocationHelpers.kt)); o default é `Long.MAX_VALUE`, mas o Fused Location Provider limita internamente a "roughly 30 seconds", e "it can take several seconds (and longer in worst case scenarios) to calculate a fresh location". <https://developers.google.com/android/reference/com/google/android/gms/location/CurrentLocationRequest.Builder>. → **Envolver a chamada num `Promise.race` com timeout próprio (ex.: 15–20 s) e mostrar "buscando sinal".**
- **Localização em cache:** o mesmo `CurrentLocationRequest` usa `setMaxUpdateAgeMillis` (default do Google: 10 s), ou seja, pode devolver uma posição histórica recente. Conferir `timestamp` do resultado. `getLastKnownPositionAsync({ maxAge, requiredAccuracy })` existe, mas **não deve ser usado para check-in**.
- **GPS desligado:** `hasServicesEnabledAsync()`; no Android, `mayShowUserSettingsDialog` (default `true`) mostra o diálogo do Google Play Services para ligar a localização; `enableNetworkProviderAsync()` pede o modo de alta precisão.
- **Precisão realista do GPS:** "GPS-enabled smartphones are typically accurate to within a 4.9 m (16 ft.) radius under open sky", piorando perto de prédios, árvores e em ambientes internos (multipath). <https://archive.gps.gov/systems/gps/performance/accuracy/> (o site avisa que não é atualizado desde fev/2025). Vendedor dentro de um mercado frequentemente terá `accuracy` de dezenas de metros — **argumento a favor de raio maior que 30 m** ou de regra que considere a incerteza.
- **SDK 58 (beta):** reescrita do `expo-location` como **preview opt-in** "alongside the existing API, so current code is unchanged". <https://expo.dev/changelog/sdk-58-beta>. Não afeta o projeto.

**Prospecção (capturar coordenadas atuais):** mesma API (`getCurrentPositionAsync` com `High`), salvando `latitude`, `longitude`, `accuracy`, `mocked` e `timestamp`.

---

## 3. Câmera e fotos de auditoria de PDV

### 3.1 `expo-image-picker` → `launchCameraAsync` (abre a câmera do sistema)

Fonte: <https://docs.expo.dev/versions/latest/sdk/imagepicker/>

- "Included in Expo Go". Pede `requestCameraPermissionsAsync()` antes.
- Opções: `quality` 0–1 (default 1.0), `allowsEditing` (crop/rotate no Android), `exif`, `base64`. Retorno: `{ canceled, assets: [{ uri, width, height, fileSize, exif? }] }`.
- **`launchCameraAsync` não deixa escolher da galeria** — bom para auditoria (a foto é tirada na hora).
- **Armadilha do Android:** o sistema pode matar a `MainActivity` enquanto a câmera está aberta e a foto se perde; usar `ImagePicker.getPendingResultAsync()` para recuperar. Testar com "Don't keep activities" nas opções de desenvolvedor.
- EXIF: a doc observa que, no iOS, o EXIF da câmera não traz tags de GPS → **gravar a localização via `expo-location` no momento da foto**, não confiar no EXIF.

### 3.2 `expo-camera` (`CameraView`, câmera dentro do app)

Fonte: <https://docs.expo.dev/versions/latest/sdk/camera/>

- "Included in Expo Go". `takePictureAsync({ quality, skipProcessing, exif, base64, shutterSound })`. URIs retornadas são **temporárias** — copiar com o file system.
- "Only one Camera preview can be active at any given time"; esperar `onCameraReady`. Mais controle de UI (sobrepor nome do PDV, timestamp), porém mais código.
- Config plugin: `recordAudioAndroid` (default `true`) e `barcodeScannerEnabled` (default `true`) — desligar ambos reduz permissões/tamanho se não usarmos vídeo/código de barras.

**Para o AXIS:** `launchCameraAsync` resolve com menos código; `expo-camera` só se o time quiser marca d'água/overlay em tela.

### 3.3 Compressão/redimensionamento — `expo-image-manipulator`

Fonte: <https://docs.expo.dev/versions/latest/sdk/imagemanipulator/>

- API nova: `ImageManipulator.manipulate(uri)` / `useImageManipulator(uri)` → `.resize({ width: 1280, height: null })` (a outra dimensão é calculada) → `renderAsync()` → `saveAsync({ compress: 0.7, format: SaveFormat.JPEG })`. `manipulateAsync` está **deprecated**.
- `saveAsync` grava no **diretório de cache** → mover para armazenamento persistente em seguida.
- "Included in Expo Go".

### 3.4 Guardar para upload posterior — `expo-file-system`

Fonte: <https://docs.expo.dev/versions/latest/sdk/filesystem/>

- `Paths.document`: "safe from being deleted by the system". `Paths.cache`: "can be deleted by the system when the device runs low on storage". → **fila de fotos pendentes em `Paths.document`**.
- API orientada a objetos: `new File(...)`, `new Directory(Paths.document, 'fotos-pendentes').create({ idempotent: true })`, `file.move(dest)` / `file.copy(dest)`.
- Upload: `file.upload(url, { uploadType: UploadType.MULTIPART, ... })` ou `createUploadTask` (progresso/cancelamento); também dá para colocar o `File` num `FormData`.
- A API antiga (`FileSystem.*`) só via `expo-file-system/legacy`; chamar pelo import principal "will throw in runtime". SDK 58 torna `File.write()` assíncrono (<https://expo.dev/changelog/sdk-58-beta>).
- "Included in Expo Go".

---

## 4. Expo Go vs development build

| Recurso | Expo Go | Precisa de dev build? |
|---|---|---|
| `expo-location` (foreground) | Sim | Não |
| `expo-image-picker`, `expo-camera`, `expo-image-manipulator`, `expo-file-system` | Sim | Não |
| `react-native-maps` (com a chave embutida do Expo Go) | Sim | Não para testar; **APK final precisa da nossa chave** |
| `expo-maps` | Não | **Sim** |
| MapLibre RN | Não | **Sim** |
| Ícone, nome, splash, permissões do `app.json`, chaves de API em config plugin | Não refletem | Sim (são do binário) |

Fontes: páginas de cada lib acima; FAQ de dev builds — Expo Go só tem as libs que vieram no binário ("only APIs and libraries that were bundled in the native app can be used"), ícone/nome/splash não são testáveis e "Each build of Expo Go supports one SDK version". <https://docs.expo.dev/develop/development-builds/faq/>

Mudanças recentes no Expo Go que pesam:

- Expo Go é "a playground app [...] not useful for building production-grade projects". <https://docs.expo.dev/workflow/expo-go/>
- **Login obrigatório** no Expo Go iOS desde 03/09/2026; Android "not affected yet", mas virá. "Login is not required for development builds." <https://expo.dev/changelog/expo-go-57-login>
- Desde 12/05/2026, Expo Go só carrega updates do EAS Update de projetos do próprio usuário/organização. <https://expo.dev/changelog/expo-go-loading-changes-may-2026>
- Quando o SDK 58 ficar estável, o Expo Go das lojas abandona o SDK 57 (seção 0).

**Como gerar dev build** (<https://docs.expo.dev/develop/development-builds/introduction/>): `npx expo install expo-dev-client` e então (a) `npx expo run:android` local, sem conta Expo, precisa Android Studio; (b) `eas build --platform android --profile development` na nuvem; ou (c) `eas build ... --local`. Rebuild só quando instalar lib nativa, mudar `app.json` ou subir SDK.

**Recomendação:** começar no **Expo Go** nas primeiras telas (tudo do AXIS roda nele, inclusive `react-native-maps`), e **migrar para development build assim que o mapa entrar com a chave própria** — no máximo antes de começar os testes em aparelho físico. Assim o time valida exatamente o mesmo binário que vira o APK e fica imune a mudanças do Expo Go.

---

## 5. Build do APK

### 5.1 EAS Build (nuvem) — plano Free

Fonte: <https://expo.dev/pricing> e <https://docs.expo.dev/billing/plans/>

- **15 builds Android + 15 iOS** no Free; "These limits reset monthly"; "Free plan accounts cannot incur overage charges".
- Fila de **baixa prioridade**: aviso de "wait times of 90+ minutes" em horário de pico. Timeout de build **45 min**, **1** build concorrente.
- 15 builds/mês é suficiente se o time **não gerar APK a cada mudança de JS** — com dev build, mudança de JS não exige rebuild.

### 5.2 Perfil para APK

Fonte: <https://docs.expo.dev/build-reference/apk/> e <https://docs.expo.dev/eas/json/>

- Por padrão o build Android de produção gera `.aab` (para a Play Store). Para APK: `"android": { "buildType": "apk" }` (roda `:app:assembleRelease`) — ou `distribution: "internal"`, ou `developmentClient: true`, que também geram APK.
- Exemplo de perfil (montado a partir da doc):

```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview":     { "distribution": "internal", "android": { "buildType": "apk" } },
    "production":  { "android": { "buildType": "apk" } }
  }
}
```

- Comando: `eas build -p android --profile preview`. Instalação: abrir a URL do build no celular, ou `adb install caminho/app.apk`, ou `eas build:run -p android --latest` (emulador).
- Assinatura: com `credentialsSource: "remote"` (default) o EAS gera e guarda o keystore — evita perder a chave entre os 3 membros.

### 5.3 Build local no Windows

- **`eas build --local` não suporta Windows:** "we do not support Windows for local builds (macOS and Linux are supported)"; WSL é mencionado como alternativa não oficial. <https://docs.expo.dev/build-reference/local-builds/>
- **`npx expo run:android` funciona no Windows**: guia oficial com Android Studio, JDK 17 (`choco install -y microsoft-openjdk17`), Android SDK Platform 36 ("Android 16 (Baklava) SDK is required"), `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, USB debugging + `adb devices`. <https://docs.expo.dev/get-started/set-up-your-environment/?platform=android&device=physical&mode=development-build&buildEnv=local>
- Release local: `npx expo prebuild` gera `android/`; a doc oficial descreve keystore com `keytool` e `./gradlew app:bundleRelease` (AAB) <https://docs.expo.dev/guides/local-app-production/>; para APK o equivalente é a task `assembleRelease` (a mesma que o EAS usa com `buildType: apk`, conforme <https://docs.expo.dev/eas/json/>). SDK 57: `expo prebuild` agora "clears and regenerates native folders by default" <https://expo.dev/changelog/sdk-57> — não editar `android/` à mão; usar config plugins.

### 5.4 Distribuição do APK em 2026 — verificação de desenvolvedor do Android (Brasil incluído)

Fonte: <https://developer.android.com/developer-verification> e FAQ <https://developer.android.com/developer-verification/guides/faq>

- Desde **30/09/2026**, em **Brasil**, Indonésia, Singapura e Tailândia, apps instalados **a partir de lojas participantes** em aparelhos certificados (Android 7+) precisam de desenvolvedor verificado; expansão global em 2027.
- **Sideload e ADB não são afetados por enquanto:** "If [...] users sideload your app directly, these new verification requirements won't apply to your app yet." e "you are free to install apps without verification with ADB".
- Se o sideload for afetado antes de dezembro, há **conta de distribuição limitada** gratuita, sem documento, para "students and hobbyists" com até **20 aparelhos**.
- **Ação:** instalar o APK da demo via link/arquivo ou `adb install` funciona hoje; acompanhar a página até a apresentação.

---

## 6. APIs externas: CEP e geocodificação

### 6.1 ViaCEP

Fonte: <https://viacep.com.br/>

- `GET https://viacep.com.br/ws/{cep}/json/` (8 dígitos). Campos: `cep, logradouro, complemento, unidade, bairro, localidade, uf, estado, regiao, ibge, gia, ddd, siafi` (testado com 74605-010 em 2026-10-12).
- CEP inexistente: `{"erro": true}` com 200; formato inválido: **HTTP 400**.
- Busca reversa: `/ws/{UF}/{cidade}/{logradouro}/json/` (mín. 3 caracteres, até 50 resultados).
- Gratuito; sem limite numérico publicado, mas "Uso massivo para validação de bases de dados locais, poderá automaticamente bloquear seu acesso".
- **Não retorna latitude/longitude.**

### 6.2 BrasilAPI

- `GET https://brasilapi.com.br/api/cep/v1/{cep}` → `cep, state, city, neighborhood, street, service, ibge` (testado em 2026-10-12; o campo `service` indica qual provedor respondeu, ex.: `open-cep`).
- `GET https://brasilapi.com.br/api/cep/v2/{cep}` → mesmos campos + `timezoneName` + `location.coordinates { latitude, longitude }` (como **strings**).
- **Como a v2 obtém coordenadas** (código-fonte): consulta o **Photon (komoot)** com rua+cidade+UF+CEP e aceita resultado cujo CEP bata (ou os 5 primeiros dígitos); se não achar, cai no **geocoding da Open-Meteo pelo nome da cidade**, ou devolve `null`. Timeout de 2 s. [`lib/fetchGeocoordinateFromBrazilLocation.js`](https://github.com/BrasilAPI/BrasilAPI/blob/main/lib/fetchGeocoordinateFromBrazilLocation.js)
- **Teste real (2026-10-12):** CEP 74605-010 (Av. Universitária, Goiânia) retornou `-16.67861, -49.25389`; CEP 01310-100 (Av. Paulista) retornou `-23.5475, -46.63611`. Ambos são o **centro do município**, não a rua — caiu no fallback por cidade. **Erro de quilômetros: inútil para geofence de 30–150 m.**
- Termos/limites: a documentação não carregou sem JS (<https://brasilapi.com.br/docs>); no código há bloqueio por User-Agent/IP abusivo com HTTP 429 ("please stop abusing our public API") em [`pages/api/cep/v3/[cep].js`](https://github.com/BrasilAPI/BrasilAPI/blob/main/pages/api/cep/v3/%5Bcep%5D.js). Sem limite numérico publicado encontrado.

### 6.3 Endereço → lat/long

- **Nominatim público (OSM)** — política de uso: <https://operations.osmfoundation.org/policies/nominatim/>. **Ler a política antes de usar**; a própria política exige que sugestões geradas por LLM apontem para ela. Pontos principais: máximo absoluto de **1 req/s somando todos os usuários do app**; User-Agent/Referer identificando o app (o User-Agent padrão de libs não serve); atribuição; **resultados devem ser cacheados**, de preferência via proxy próprio; **autocomplete no cliente é proibido**; uso disparado pelo usuário é aceitável "provided that your number of users is moderate"; o app deve conseguir trocar de serviço a pedido deles.
- **Google Geocoding API**: SKU *Geocoding* (Essentials), **10.000 eventos/mês grátis**, depois US$ 5,00 por 1.000 (<https://developers.google.com/maps/billing-and-pricing/pricing>); exige billing e chave (<https://developers.google.com/maps/documentation/geocoding/usage-and-billing>). Restrições de cache nos Maps Service Terms; place IDs podem ser guardados indefinidamente (<https://developers.google.com/maps/documentation/geocoding/policies>).
- **Alternativa que dispensa geocodificação no fluxo crítico:** o cadastro/prospecção é feito **no local**, então a coordenada do cliente pode vir do **GPS do aparelho** (seção 2), não do endereço. O CEP serve só para preencher o endereço. Geocodificar endereço só é necessário para clientes cadastrados pelo painel web, sem visita.

---

## Recomendação

1. **SDK:** começar no **Expo SDK 57** (estável). Não migrar para o 58 antes da apresentação, a menos que saia estável com folga e o time precise de algo dele.
2. **Fluxo de desenvolvimento:** Expo Go só no começo; **development build** (`expo-dev-client`) assim que o mapa com chave própria entrar — e obrigatoriamente antes dos testes em aparelho físico.
3. **Mapa:** **`react-native-maps` com Google Maps no Android** — funciona no Expo Go, é estável, uso mobile sem cobrança. Um membro cria **uma** conta Google Cloud com billing, chave restrita ao package + SHA-1 do keystore do EAS, chave via variável de ambiente no `app.config`. **Plano B** sem billing: MapLibre RN + tiles OSM (exige dev build, aceitar política OSM sem SLA). Descartar `expo-maps` (alpha). Navegação até o cliente via **Maps URLs** (sem chave, sem custo).
4. **GPS:** `expo-location` com `Accuracy.High`/`Highest`, timeout próprio, exigir permissão **precisa** no Android, enviar ao backend `latitude, longitude, accuracy, mocked, timestamp`. Regra de check-in sugerida para a decisão: aceitar se `distância ≤ raio` **e** `accuracy ≤ limite`; registrar `mocked=true` como alerta (não bloquear às cegas). Dado o ~5 m em céu aberto e a piora dentro de lojas, o raio de 30 m tende a gerar recusas falsas; 100–150 m é mais realista — decidir com teste de campo.
5. **Fotos:** `expo-image-picker.launchCameraAsync` (com `getPendingResultAsync`) → `expo-image-manipulator` (largura ~1280 px, JPEG ~0,7) → mover para `Paths.document` → fila de upload com `File.upload` multipart. Localização da foto vinda do `expo-location`, não do EXIF.
6. **APK:** **EAS Build na nuvem** com perfil `preview` (`buildType: "apk"`), credenciais gerenciadas pelo EAS; reservar os 15 builds/mês para marcos (dev build + APKs de teste/demo). Fallback no Windows: `npx expo run:android` / `assembleRelease` local com Android Studio (não `eas build --local`). Instalação por link ou `adb install` — não afetada pela verificação de desenvolvedor por enquanto.
7. **CEP:** **ViaCEP** como principal (estável, campos em PT-BR, 400/`erro`); **BrasilAPI v1** como fallback. **Não usar coordenadas da BrasilAPI v2** para geofence. Coordenadas do cliente vêm do GPS no cadastro em campo; se o painel web precisar geocodificar endereço, fazer **no backend**, com cache, seguindo a política do Nominatim (ou Google Geocoding, 10k/mês grátis, se já houver billing).

## Pontos que a decisão "Stack complementar do mobile" precisa fechar

- [ ] **Versão do SDK** travada (57) e política de upgrade até dezembro.
- [ ] **Biblioteca de mapa:** `react-native-maps`/Google vs MapLibre/OSM — depende de **alguém do time aceitar cadastrar billing no Google Cloud**. Quem é o dono da conta e da chave?
- [ ] **Onde fica a chave do Maps** (variável de ambiente no EAS / `.env` fora do git) e qual SHA-1 é registrado (keystore do EAS; dev e release).
- [ ] **Raio do geofence** (30, 50, 100 ou 150 m) e **limite de `accuracy`** aceito; o que fazer quando `accuracy` > limite (tentar de novo? permitir com justificativa?).
- [ ] **Tratamento de `mocked`:** bloquear o check-in, permitir marcando como suspeito, ou só registrar? (Lembrar: só Android, só pega apps de mock location.)
- [ ] **Permissão aproximada:** bloquear o check-in se o Android conceder só `coarse`?
- [ ] **Câmera:** `launchCameraAsync` vs `CameraView` (overlay com nome do PDV/data?); resolução e qualidade alvo das fotos.
- [ ] **Offline:** fotos e check-ins ficam numa fila local para upload posterior? (impacta `expo-file-system` + persistência de metadados.)
- [ ] **Fluxo de dev:** a partir de qual marco o time abandona o Expo Go e passa ao development build.
- [ ] **Build:** EAS na nuvem como padrão? Quem dispara builds (orçamento de 15/mês)? Perfis `development`/`preview`/`production` no `eas.json`.
- [ ] **`minSdkVersion`:** deixar o default 24 ou forçar 26 para casar literalmente com o RNF09.
- [ ] **CEP:** ViaCEP principal + BrasilAPI fallback, chamados do app ou proxied pelo backend?
- [ ] **Geocodificação de endereço** (clientes cadastrados no painel web): necessária no MVP? Se sim, Nominatim via backend com cache ou Google Geocoding.
- [ ] **Distribuição do APK** na demo: link do EAS vs `adb install`; acompanhar a verificação de desenvolvedor do Android (Brasil) até dezembro.
