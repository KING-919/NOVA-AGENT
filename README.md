<div align="center">
  <img src="docs/assets/nova-banner.svg" alt="NOVA Agent — a local-first AI coding workspace" width="100%" />

  <p><strong>A local-first AI workspace for building with the models and APIs you choose.</strong></p>
  <p><a href="#quick-start">Quick start</a> · <a href="https://king-919.github.io/NOVA-AGENT-Website/">Download</a> · <a href="#architecture">Architecture</a> · <a href="#البدء-السريع">العربية</a></p>

  <p>
    <a href="https://github.com/KING-919/NOVA-AGENT-Website/actions/workflows/pages.yml"><img alt="Download site" src="https://github.com/KING-919/NOVA-AGENT-Website/actions/workflows/pages.yml/badge.svg"></a>
    <a href="https://github.com/KING-919/NOVA-AGENT/actions/workflows/release.yml"><img alt="Windows release build" src="https://github.com/KING-919/NOVA-AGENT/actions/workflows/release.yml/badge.svg"></a>
    <a href="https://github.com/KING-919/NOVA-AGENT/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/KING-919/NOVA-AGENT?display_name=tag"></a>
    <a href="https://github.com/KING-919/NOVA-AGENT/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/KING-919/NOVA-AGENT?style=flat"></a>
    <a href="#license"><img alt="License not selected" src="https://img.shields.io/badge/license-not%20selected-lightgrey"></a>
  </p>
</div>

NOVA Agent is an Arabic-first desktop coding assistant for Windows. It brings chat, project context, file tools, and model-provider settings into one workspace. Connect a local model or an API that follows the OpenAI-compatible chat-completions format.

> NOVA is an independent project. It does not include or bundle a model or API subscription. You provide the model endpoint and, when required, its API key.

## What you can do

- Stream a conversation with a selected model and keep separate sessions.
- Ask for a plan, answer clarifying questions, and approve file edits or shell commands before they run.
- Read and edit workspace files, search project text, and preview files read-only.
- Choose a local or hosted model provider and configure a compatible custom endpoint.
- Review session history, use prompt templates and the `Ctrl+Shift+P` command palette, and export Markdown.
- Use Arabic RTL, light and dark themes, and a responsive web interface inside the Windows desktop app.

## Quick start

### Windows desktop

1. [Download the latest NOVA installer](https://king-919.github.io/NOVA-AGENT-Website/) and install it.
2. Open **Settings → AI provider** and choose a local model or enter your API provider, model ID, and API key.
3. Select a workspace, start a chat, and begin in **Ask** or **Plan** mode. Review each requested edit or command before approving it.

### Run from source

Requirements: Node.js `>=22.12.0` and npm.

```powershell
git clone https://github.com/KING-919/NOVA-AGENT.git
cd NOVA-AGENT
npm ci
npm start
```

Open [http://localhost:3456](http://localhost:3456). To run the Electron window during development, use `npm run desktop`. On Windows, `start.bat` is also available.

### Optional: Docker

Docker runs NOVA's web interface and local agent server; it does not run the Electron desktop window.

```sh
docker compose up --build
```

Then open [http://localhost:3456](http://localhost:3456). The port is bound to loopback on the host. Chat settings are stored in a named Docker volume; the workspace is mounted at `./workspace`. To reach a model on the host, set `LMSTUDIO_BASE_URL` (default: `http://host.docker.internal:1234`) before starting Compose.

## Model providers

Built-in choices include LM Studio, Ollama, OpenAI, OpenRouter, Groq, Google Gemini's OpenAI-compatible endpoint, FreeLLMAPI, and a custom OpenAI-compatible endpoint. Availability, model IDs, tool calling, pricing, and data handling depend on the provider. Keep API keys in NOVA's local settings; never commit them to Git.

## Architecture

```mermaid
flowchart LR
  User[User] --> UI[Arabic web UI]
  Desktop[Electron main process] --> Server[Local Express server]
  UI -->|HTTP and event stream| Server
  Server --> Agent[Agent loop]
  Agent --> Provider[Selected model API]
  Provider --> Agent
  Agent --> Tools[Workspace tools]
  Tools -->|approved changes and commands| Workspace[Project workspace]
  Server --> LocalData[Local settings and sessions]
```

The Electron main process starts the local server and hosts the same interface available in a browser. The server streams agent events to the UI. The agent uses provider adapters and workspace tools; file writes and shell commands can require user approval. Settings and sessions stay in the app's local data directory.

## Build a Windows installer

```powershell
npm ci
npm run dist:win
```

The installer is written to `dist/NOVA-Setup-win-x64.exe`. Pushing a version tag such as `v2.1.4` triggers the Windows build and attaches the installer to a GitHub Release. The installer is not code-signed, so Windows may show a publisher warning.

## Contributing

Bug reports and pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. For suspected security issues, follow [SECURITY.md](SECURITY.md) and do not post exploit details in a public issue.

## Security and privacy

NOVA can read and write files and run commands inside the selected workspace. Start in **Ask** or **Plan** mode and inspect approval requests. Enabling access outside the workspace or automatic command execution broadens what the agent can do. When you use a hosted provider, prompts and the project context sent by NOVA are subject to that provider's policies.

Official website: [nova-agent1.netlify.app](https://nova-agent1.netlify.app) · [GitHub Pages downloads](https://king-919.github.io/NOVA-AGENT-Website/) · [Website source repository](https://github.com/KING-919/NOVA-AGENT-Website).

## License

No license has been selected yet. The repository is publicly viewable, but public visibility alone does not grant permission to reuse or redistribute its code. A license badge will be added when the project owner chooses a license.

---

## البدء السريع

### تطبيق Windows

1. [نزّل أحدث إصدار من NOVA](https://king-919.github.io/NOVA-AGENT/) وثبّته.
2. افتح **الإعدادات ← مزوّد الذكاء الاصطناعي**، ثم اختر نموذجًا محليًا أو أدخل عنوان API ومعرّف النموذج والمفتاح عند الحاجة.
3. اختر مساحة العمل وابدأ بوضع **اسأل** أو **خطّط**. راجع طلبات تعديل الملفات وتشغيل الأوامر قبل الموافقة.

### التشغيل من المصدر

المتطلبات: Node.js إصدار `22.12.0` أو أحدث وnpm.

```powershell
git clone https://github.com/KING-919/NOVA-AGENT.git
cd NOVA-AGENT
npm ci
npm start
```

افتح [http://localhost:3456](http://localhost:3456). لتشغيل نافذة Electron أثناء التطوير استخدم `npm run desktop`، أو `start.bat` على Windows.

### التشغيل الاختياري عبر Docker

يشغّل Docker واجهة الويب وخادم الوكيل؛ ولا يشغّل نافذة Electron.

```sh
docker compose up --build
```

ثم افتح [http://localhost:3456](http://localhost:3456). المنفذ متاح محليًا على الجهاز فقط. تحفظ إعدادات الجلسة في وحدة Docker، وتُربط مساحة العمل بالمجلد `./workspace`. للاتصال بنموذج يعمل على الجهاز المضيف، عيّن `LMSTUDIO_BASE_URL` قبل تشغيل Compose؛ القيمة الافتراضية `http://host.docker.internal:1234`.

## المزايا

- محادثة متدفقة وجلسات مستقلة مع اختيار النموذج.
- تخطيط للمهام وأسئلة توضيحية وموافقة قبل التعديلات والأوامر.
- قراءة الملفات وتحريرها والبحث داخل المشروع ومعاينة قراءة فقط.
- مزوّدات محلية وسحابية وعناوين API مخصصة متوافقة مع OpenAI.
- قوالب جاهزة، سجل جلسات، لوحة أوامر `Ctrl+Shift+P`، وتصدير Markdown.
- واجهة عربية RTL وسمات فاتحة وداكنة وتطبيق Windows.

## المزوّدات

يدعم المشروع LM Studio وOllama وOpenAI وOpenRouter وGroq وواجهة Gemini المتوافقة مع OpenAI وFreeLLMAPI وأي عنوان مخصص متوافق مع OpenAI Chat Completions. تختلف النماذج والأسعار واستدعاء الأدوات وسياسات البيانات بحسب المزوّد. لا ترفع مفاتيح API إلى Git.

## الأمان والخصوصية

يستطيع NOVA قراءة ملفات مساحة العمل وتعديلها وتشغيل أوامر فيها. ابدأ بوضع **اسأل** أو **خطّط** وراجع طلبات الموافقة. تفعيل الوصول خارج مساحة العمل أو التشغيل التلقائي يوسّع صلاحيات الوكيل. عند استخدام مزوّد سحابي، تخضع الرسائل وسياق المشروع المرسل لسياسة ذلك المزوّد.

للمساهمة راجع [CONTRIBUTING.md](CONTRIBUTING.md)، وللإبلاغ عن مشكلة أمنية راجع [SECURITY.md](SECURITY.md). لم يُحدد ترخيص للمشروع بعد؛ ظهور المستودع للعامة لا يمنح تلقائيًا حق إعادة استخدام الكود أو توزيعه.

موقع التنزيل: [nova-agent1.netlify.app](https://nova-agent1.netlify.app) · [نسخة GitHub Pages](https://king-919.github.io/NOVA-AGENT-Website/) · [مستودع الموقع](https://github.com/KING-919/NOVA-AGENT-Website).
