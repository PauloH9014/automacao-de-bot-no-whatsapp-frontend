# Automação de bot no WhatsApp — Front-end

Interface web estática para consultar alunos por dia/horário e solicitar avisos
de falta à API do projeto
[whatsapp-bot-automation](https://github.com/PauloH9014/whatsapp-bot-automation).
Este repositório contém somente HTML, CSS e JavaScript do front-end.

**Demonstração na Vercel:** <https://automacao-de-bot-no-whatsapp-fronte.vercel.app>

A integração de WhatsApp do projeto usa a
[Evolution API](https://github.com/EvolutionAPI/evolution-api), uma API open
source independente (não é a API oficial da Meta/WhatsApp).

## Executar localmente

Sirva a pasta raiz com qualquer servidor HTTP estático. Por exemplo:

```powershell
python -m http.server 5500
```

Abra <http://127.0.0.1:5500/src/html/Home.html>. Por padrão, a interface tenta
acessar o backend local em `http://127.0.0.1:8000`.

## Configurar a API

Edite `src/js/config.js` e informe somente a URL pública da API, sem adicionar
segredos:

```javascript
window.AUTOMATION_PYBOT_API_URL = "https://seu-backend.exemplo";
```

O backend deve permitir a origem publicada pelo front-end em sua configuração
CORS. Não coloque `BACKEND_API_TOKEN`, chaves da Evolution API, senhas ou outros
segredos em JavaScript: qualquer valor no navegador fica público.

As rotas de envio do backend exigem autenticação. Um front-end estático não
consegue guardar com segurança um token de servidor; para habilitar envios em
produção, o backend precisa fornecer um proxy autenticado apropriado. O
repositório deste front-end não inclui nem altera esse serviço.

