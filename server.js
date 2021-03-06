const express = require('express')
const favicon = require('serve-favicon')
const path = require('path')
const compression = require('compression')
const Raven = require('raven')
const AV = require('leanengine')

const config = require('./config')
const { clientGlobalVars } = require('./clientGlobalVar')
const { refreshWebhooks } = require('./api/webhook')
const { validateTriggers } = require('./api/rule/trigger')

Raven.config(config.sentryDSN).install()

const app = express()
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(compression())
app.use(Raven.requestHandler())

// 加载云引擎中间件
app.use(AV.express())

app.disable('x-powered-by')
app.enable('trust proxy')
app.use(AV.Cloud.HttpsRedirect())

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(require('./api'))

const { orgName } = require('./api/oauth')

const getIndexPage = () => {
  return `<!doctype html>
<html>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<title>LeanTicket</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.10.0/styles/github.min.css">
<link rel="stylesheet" href="/css/react-datepicker.css">
<link rel="stylesheet" href="/index.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/docsearch.js/2/docsearch.min.css" />
<link rel="stylesheet" href="/css/docsearch-override.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/4.0.0/github-markdown.min.css" integrity="sha512-Oy18vBnbSJkXTndr2n6lDMO5NN31UljR8e/ICzVPrGpSud4Gkckb8yUpqhKuUNoE+o9gAb4O/rAxxw1ojyUVzg==" crossorigin="anonymous" />
<link rel="stylesheet" href="${process.env.WEBPACK_DEV_SERVER || ''}/app.css">
<link rel="stylesheet" href="/css/leancloud-compatible.css">
<div id=app></div>
<script>
  Object.assign(window, ${JSON.stringify(clientGlobalVars)})
  LEAN_CLI_HAVE_STAGING = '${process.env.LEAN_CLI_HAVE_STAGING}'
  SENTRY_DSN_PUBLIC = '${config.sentryDSNPublic || ''}'
  ORG_NAME = '${orgName}'
  USE_OAUTH = ${!!process.env.OAUTH_KEY}
  ALGOLIA_API_KEY = '${process.env.ALGOLIA_API_KEY || ''}'
  FAQ_VIEWS = '${process.env.FAQ_VIEWS || ''}'
</script>
<script src='${process.env.WEBPACK_DEV_SERVER || ''}/bundle.js'></script>
<script>
  window.addEventListener('load', function () {
    if (window.Notification && Notification.permission !== "granted") {
      Notification.requestPermission(function (status) {
        if (Notification.permission !== status) {
          Notification.permission = status;
        }
      });
    }
  })
</script>`
}

app.get('*', function (req, res) {
  res.send(getIndexPage())
})

app.use(Raven.errorHandler())

// error handlers
app.use(function (err, req, res, _next) {
  var statusCode = err.status || 500
  if (statusCode === 500) {
    console.error(err.stack || err)
  }
  res.status(statusCode).json({ message: err.message })
})

const PORT = parseInt(process.env.LEANCLOUD_APP_PORT || process.env.PORT || 8080)
app.listen(PORT, function () {
  console.log('LeanTicket server running on:' + PORT)
})

refreshWebhooks()
validateTriggers()
  .then(({ success, fail }) => {
    console.log(`[Trigger] triggers validated(success: ${success}, fail: ${fail})`)
    return
  })
  .catch(console.error)
