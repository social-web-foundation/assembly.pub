import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'
import { MicroblogElement } from './microblog-element.js'

export class MicroblogNewNoteElement extends MicroblogElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--gap, 1rem);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    sl-dropdown,
    sl-input,
    sl-textarea,
    sl-radio-group {
      width: 100%;
    }
    sl-menu {
      max-height: 16rem;
      overflow-y: auto;
    }
    sl-radio-group {
      display: flex;
      gap: 1rem;
    }
    .actions {
      text-align: right;
    }
  `

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _Microblog: { type: Array, state: true },
      _selectedFilm: { type: String, state: true },
      _note: { type: String, state: true },
      _privacy: { type: String, state: true },
      _submitting: { type: Boolean, state: true }
    }
  }

  constructor () {
    super()
    this._Microblog = []
    this._query = ''
    this._note = ''
    this._privacy = 'public'
    this._searchTimer = null
    this._submitting = false
  }

  connectedCallback () {
    super.connectedCallback()
  }

  _onNoteInput (event) {
    this._note = event.target.value
  }

  _onPrivacyChange (event) {
    this._privacy = event.target.value
  }

  render () {
    if (this._error) {
      return html`<sl-alert variant="danger">${this._error}</sl-alert>`
    }
    return html`
      <div class="form-group">
        <sl-textarea
          label="Note"
          placeholder="Add a note"
          .value=${this._note}
          @sl-input=${this._onNoteInput}
        ></sl-textarea>
      </div>
      <div class="form-group">
        <sl-radio-group
          label="Visibility"
          name="visibility"
          .value=${this._privacy}
          @sl-change=${this._onPrivacyChange}
        >
          <sl-radio value="public">Public</sl-radio>
          <sl-radio value="private">Private</sl-radio>
        </sl-radio-group>
      </div>
      <div class="form-group actions">
        <sl-button
          variant="primary"
          ?disabled=${!this._note || this._submitting}
          ?loading=${this._submitting}
          @click=${this._submitCreate}
        >
          Post!
        </sl-button>
      </div>
    `
  }

  async _submitCreate () {
    if (this._submitting) return
    this._submitting = true
    try {
      const actor = await this.getActor()
      const content = (this._note) ? this._note.trim() : undefined

      const activity = {
        actor: {
          id: actor.id,
          name: actor.name,
          url: actor.url
        },
        type: 'Create',
        object: {
          type: 'Note',
          content: this._note
        },
        content
      }

      const followers = await this.toId(actor.followers)

      if (this._privacy === 'public') {
        activity.to = 'https://www.w3.org/ns/activitystreams#Public'
        activity.cc = followers
      } else {
        activity.to = followers
      }

      activity.summaryMap = {
        en: this.makeSummary(activity)
      }

      await this.doActivity(activity)
      window.location = '/'
    } catch (err) {
      this._error = err.message
      this._submitting = false
    }
  }
}

customElements.define('microblog-new-note', MicroblogNewNoteElement)
