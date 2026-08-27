import {
  html,
  css
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { AssemblyElement } from './assembly-element.js'
import './assembly-activity.js'

const ACTIVITY_TYPES = [
  'Activity',
  'IntransitiveActivity',
  'Accept',
  'Add',
  'Announce',
  'Arrive',
  'Block',
  'Create',
  'Delete',
  'Dislike',
  'Flag',
  'Follow',
  'Ignore',
  'Invite',
  'Join',
  'Leave',
  'Like',
  'Listen',
  'Move',
  'Offer',
  'Question',
  'Reject',
  'Read',
  'Remove',
  'TentativeReject',
  'TentativeAccept',
  'Travel',
  'Undo',
  'Update',
  'View'
]

const NON_ACTIVITY_TYPES = [
  'Application',
  'Group',
  'Organization',
  'Person',
  'Service',
  'Article',
  'Audio',
  'Document',
  'Event',
  'Image',
  'Note',
  'Page',
  'Place',
  'Profile',
  'Relationship',
  'Tombstone',
  'Video',
  'Mention',
  'Collection',
  'OrderedCollection',
  'CollectionPage',
  'OrderedCollectionPage',
  'Link'
]

const ACTIVITY_PROPS = [
  'actor', 'object', 'target', 'result', 'origin', 'instrument'
]

function isActivity (object) {
  if (!object.type) return false
  const types = Array.isArray(object.type) ? object.type : [object.type]
  for (const type of types) {
    if (ACTIVITY_TYPES.includes(type)) {
      return true
    }
  }
  for (const type of types) {
    if (NON_ACTIVITY_TYPES.includes(type)) {
      return false
    }
  }
  for (const prop of ACTIVITY_PROPS) {
    if (prop in object) {
      return true
    }
  }
}

export class AssemblyGroupElement extends AssemblyElement {
  static styles = css`
    .group-header {
      align-items: center;
      display: flex;
      gap: 0.75rem;
      margin-bottom: var(--gap);
    }

    .group-header sl-avatar {
      --size: 3rem;
    }

    .group-name {
      margin: 0;
    }

    .group-id {
      color: var(--sl-color-neutral-600);
      font-size: 0.875rem;
      margin: 0.25rem 0 0 0;
      overflow-wrap: anywhere;
    }

    .activity-heading {
      align-items: center;
      display: flex;
      gap: 0.5rem;
    }
  `

  MAX_ACTIVITIES = 20
  MAX_TIME_WINDOW = 30 * 24 * 60 * 60 * 1000

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      group: { type: Object },
      _error: { type: String, state: true },
      _activities: { type: Array, state: true },
      _groupActor: { type: Object, state: true },
      _isLoading: { type: Boolean, state: true }
    }
  }

  constructor () {
    super()
    this.group = null
    this._activities = []
    this._groupActor = null
    this._isLoading = false
  }

  connectedCallback () {
    super.connectedCallback()
    this._loadActivities().then(() => {
      console.log('Group activities loaded')
    })
  }

  updated (changedProperties) {
    if (changedProperties.has('group')) {
      this._loadActivities().then(() => {
        console.log('Group activities loaded')
      })
    }
  }

  render () {
    const group = this._groupActor ?? this.group
    const name = group?.name ?? 'Group'
    const id = group?.id
    return this._error
      ? html`<sl-alert variant="danger">${this._error}</sl-alert>`
      : html`
          <section class="group-header">
            <sl-avatar
              image=${this.getIcon(group)}
              label=${name}
            ></sl-avatar>
            <div>
              <h2 class="group-name">${name}</h2>
              ${id ? html`<p class="group-id">${id}</p>` : html``}
            </div>
          </section>

          <h3 class="activity-heading">
            Activities
            ${this._isLoading ? html`<sl-spinner></sl-spinner>` : html``}
          </h3>
          <div class="group-activities">
            ${this._activities && this._activities.length > 0
              ? this._activities.map(
                  activity =>
                    html`<assembly-activity
                      redirect-uri=${this.redirectUri}
                      client-id=${this.clientId}
                      .activity=${activity}>
                    </assembly-activity>`
                )
              : html`<div><p>No activities.</p></div>`}
          </div>
        `
  }

  async _loadActivities () {
    this._isLoading = true
    this._error = null
    this._activities = []

    try {
      this._groupActor = await this._loadGroupActor()
      const outbox = await this._outboxId()
      if (!outbox) {
        return
      }

      const cacheKey = `group-activities:${this.group.id}`
      const activitiesJSON = localStorage.getItem(cacheKey)
      const cached = activitiesJSON ? JSON.parse(activitiesJSON) : []

      if (cached.length > 0) {
        this._activities = [...cached].slice(0, this.MAX_ACTIVITIES)
      }

      const latestId = cached && cached.length > 0 ? cached[0].id : null
      const activities = []

      for await (const activity of this.items(outbox)) {
        if (!isActivity(activity)) {
          continue
        }
        if (latestId && activity.id === latestId) {
          break
        }
        if (this.isAssemblyActivity(activity)) {
          const required = ['id', 'type', 'published', 'actor', 'object']
          activities.push(await this.toObject(activity, { required }))
          this._activities = [...activities, ...cached].slice(
            0,
            this.MAX_ACTIVITIES
          )
        }
        if (activities.length >= this.MAX_ACTIVITIES) {
          break
        }
        const timestamp = activity.updated
          ? activity.updated
          : activity.published

        if (new Date(timestamp).getTime() <= Date.now() - this.MAX_TIME_WINDOW) {
          break
        }
      }

      if (this._activities) {
        localStorage.setItem(cacheKey, JSON.stringify(this._activities))
      }
    } catch (err) {
      this._error = err.message
    } finally {
      this._isLoading = false
    }
  }

  async _outboxId () {
    const group = this._groupActor ?? this.group
    if (!group) {
      return null
    }
    return await this.toId(group.outbox)
  }

  async _loadGroupActor () {
    if (!this.group?.id || this.group.name || this.group.outbox) {
      return this.group
    }
    return await this.toObject(this.group.id)
  }

  isAssemblyActivity (activity) {
    const hasType = (value, target) => {
      if (!value) return false
      return Array.isArray(value) ? value.includes(target) : value === target
    }
    return hasType(activity.type, 'Create') &&
      hasType(activity.object?.type, 'Note')
  }
}

customElements.define('assembly-group', AssemblyGroupElement)
