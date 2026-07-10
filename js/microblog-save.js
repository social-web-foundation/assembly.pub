import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import * as oauth from 'https://cdn.jsdelivr.net/npm/oauth4webapi@3/+esm'

export class MicroblogSaveElement extends LitElement {
  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      successUri: { type: String, attribute: 'success-uri' },
      _error: { type: String, state: true }
    }
  }

  #authorizationServer
  #client
  #clientAuth
  #state
  #codeVerifier

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
    this.handleLogin()
      .then(() => {
        window.location = this.redirectUri
      })
      .catch((err) => {
        this._error = err.message
      })
  }

  clearSession () {
    sessionStorage.removeItem('state')
    sessionStorage.removeItem('code_verifier')
  }

  saveResult (result) {
    localStorage.setItem('access_token', result.access_token)
    localStorage.setItem('refresh_token', result.refresh_token)
    localStorage.setItem('expires_in', result.expires_in)
    localStorage.setItem(
      'expires',
      Date.now() + result.expires_in * 1000
    )
  }

  async handleLogin () {
    const origin = (new URL(localStorage.getItem('actor_id'))).origin
    const as =
      JSON.parse(sessionStorage.getItem(`as:${origin}`))

    const clientAuth = oauth.None()

    const client = {
      client_id: this.clientId
    }

    const state = sessionStorage.getItem('state')
    const codeVerifier = sessionStorage.getItem('code_verifier')

    try {
      const params = oauth.validateAuthResponse(
        as,
        client,
        new URLSearchParams(window.location.search),
        state
      )

      const response = await oauth.authorizationCodeGrantRequest(
        as,
        client,
        clientAuth,
        params,
        this.redirectUri,
        codeVerifier
      )

      const result = await oauth.processAuthorizationCodeResponse(
        as,
        client,
        response
      )

      this.saveResult(result)

      this.clearSession()

      window.location = this.successUri
    } catch (error) {
      this._error = error.message
    }
  }

  render () {
    return (this._error)
      ? html`<sl-alert>${this._error}</sl-alert>`
      : html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }
}

customElements.define('microblog-save', MicroblogSaveElement)
