import {
  html,
  css
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { AssemblyElement } from './assembly-element.js'
import './assembly-new-note.js'
import './assembly-group.js'

export class AssemblyHomeElement extends AssemblyElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
    }

    header,
    main,
    footer {
      width: 100%;
      max-width: var(--max-width);
      margin: 0 auto;
      padding: var(--gap);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gap);
    }

    .primary-nav,
    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .brand a {
      color: inherit;
      font-weight: 700;
      text-decoration: none;
    }

    .group-select {
      min-width: 14rem;
    }

    .join-group {
      white-space: nowrap;
    }

    @media (max-width: 640px) {
      header {
        align-items: stretch;
        flex-direction: column;
      }

      .primary-nav,
      .actions {
        justify-content: space-between;
      }

      .group-select {
        flex: 1;
        min-width: 0;
      }
    }
  `

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _route: { type: String, state: true },
      _error: { type: String, state: true },
      _actor: { type: Object, state: true },
      _groups: { type: Array, state: true },
      _groupsLoading: { type: Boolean, state: true },
      _groupActorId: { type: String, state: true }
    }
  }

  constructor () {
    super()
    this._groups = []
    this._groupsLoading = false
    this._groupActorId = null
    this._route = ''
  }

  connectedCallback () {
    super.connectedCallback()
    this._updateRoute()
    this.getActor()
      .then((actor) => {
        this._actor = actor
        return this._loadGroups(actor)
      })
      .catch((err) => {
        this._error = err.message
      })
    window.addEventListener('popstate', this._updateRoute.bind(this))
  }

  render () {
    return html`

    <header>

      <div class="primary-nav">
        <span class="brand"><a href=${this._groupActorId ? `#${this._groupRoute(this._groupActorId)}` : '#'}>Assembly</a></span>

        ${this._groups.length > 0
          ? html`<sl-select
              class="group-select"
              placeholder="Groups"
              value=${this._groupActorId}
              @sl-change=${this._groupChange.bind(this)}
            >
              ${this._groups.map(group => html`
                <sl-option value=${group.actor.id}>${group.actor.name}</sl-option>
              `)}
            </sl-select>`
          : html`<sl-button class="join-group" disabled>Join Group</sl-button>`}
      </div>

      <!-- User menu dropdown -->
      <div class="actions">
        <sl-button href="#assembly" variant="primary">
          +
        </sl-button>

        <sl-dropdown>
          <sl-button slot="trigger" caret>${(this._actor) ? this._actor.name : 'User'}</sl-button>
          <sl-menu @sl-select=${this._menuSelect.bind(this)}>
            <sl-menu-item value="settings">
              <sl-icon slot="prefix" name="gear"></sl-icon>
              Settings
            </sl-menu-item>
            <sl-menu-item value="logout">
              <sl-icon slot="prefix" name="box-arrow-left"></sl-icon>
              Log out
            </sl-menu-item>
          </sl-menu>
        </sl-dropdown>
      </div>
    </header>

    <main>
      ${this._route.startsWith('group/') && this._groupActorId
        ? html`<assembly-group
            redirect-uri=${this.redirectUri}
            client-id=${this.clientId}
            .group=${this._selectedGroupActor}>
          </assembly-group>`
        : (this._route === 'assembly')
          ? html`<assembly-new-note redirect-uri=${this.redirectUri}   client-id=${this.clientId} />`
          : this._groupsLoading
            ? html`<sl-spinner></sl-spinner>`
            : this._groups.length === 0
              ? html`
                  <p>No groups yet.</p>
                  <sl-button disabled>Join Group</sl-button>
                `
          : html`<sl-alert>Unknown route</sl-alert>`
      }
    </main>

    <footer>
      <a href="https://github.com/social-web-foundation/assembly.pub/">GitHub</a>
    </footer>
    `
  }

  _menuSelect (event) {
    const value = event.detail.item.value
    window.location.hash = value
  }

  _groupChange (event) {
    const groupActorId = event.target.value
    this._groupActorId = groupActorId
    window.location.hash = this._groupRoute(groupActorId)
  }

  get _selectedGroupActor () {
    return this._groups.find(group => group.actor.id === this._groupActorId)?.actor ??
      {
        id: this._groupActorId,
        type: 'Group'
      }
  }

  async _loadGroups (actor) {
    this._groupsLoading = true
    try {
      const collection = actor.groups ?? actor.following
      if (!collection) {
        this._groups = []
        return
      }

      const groups = []
      for await (const item of this.items(collection)) {
        const group = await this.toObject(item, { required: ['id', 'type'] })
        if (this._isGroupActor(group) && !groups.some(existing => existing.actor.id === group.id)) {
          groups.push({ actor: group })
          this._groups = [...groups]
        }
      }

      if (!this._groupActorId && this._groups.length > 0) {
        this._groupActorId = this._groups[0].actor.id
        this._route = this._groupRoute(this._groupActorId)
        window.history.replaceState(null, '', `#${this._route}`)
      }
    } finally {
      this._groupsLoading = false
    }
  }

  _isGroupActor (actor) {
    if (!actor?.type) {
      return false
    }
    return Array.isArray(actor.type)
      ? actor.type.includes('Group')
      : actor.type === 'Group'
  }

  _updateRoute () {
    const route = (window.location.hash)
      ? window.location.hash.replace('#', '')
      : this._groupActorId
        ? this._groupRoute(this._groupActorId)
        : ''
    if (route === 'logout') {
      this._logout()
    } else {
      this._route = route
    }
    if (route.startsWith('group/')) {
      const groupActorId = this._groupActorIdFromRoute(route)
      if (groupActorId) {
        this._groupActorId = groupActorId
      }
    }
  }

  _groupRoute (actorId) {
    if (!actorId) {
      return ''
    }
    return `group/${actorId.replace(/^https:\/\//, '')}`
  }

  _groupActorIdFromRoute (route) {
    if (!route.startsWith('group/')) {
      return null
    }
    return `https://${route.slice('group/'.length)}`
  }

  _logout () {
    localStorage.clear()
    window.location = this.redirectUri
  }
}

customElements.define(
  'assembly-home',
  AssemblyHomeElement
)
