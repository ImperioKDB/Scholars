#!/usr/bin/env node

import { Inngest } from 'inngest'

const EVENT_NAME = 'notification/profile-nudge.requested'
const CONFIRMATION = 'PROFILE_NUDGE_TEST'

function usage(message) {
  if (message) console.error(`Error: ${message}\n`)
  console.error('Usage:')
  console.error('  INNGEST_EVENT_KEY=... node scripts/trigger-profile-nudge.mjs --delivery-id <id> --confirm PROFILE_NUDGE_TEST')
  process.exit(1)
}

const args = process.argv.slice(2)
const valueAfter = (flag) => {
  const index = args.indexOf(flag)
  return index === -1 ? undefined : args[index + 1]
}

const deliveryId = valueAfter('--delivery-id')
const confirmation = valueAfter('--confirm')
const eventKey = process.env.INNGEST_EVENT_KEY

if (!eventKey) usage('INNGEST_EVENT_KEY is required.')
if (!deliveryId) usage('--delivery-id is required. It must be an existing profile_nudge notification_deliveries.id.')
if (deliveryId.startsWith('-')) usage('--delivery-id must be a value, not another flag.')
if (confirmation !== CONFIRMATION) {
  usage(`Pass --confirm ${CONFIRMATION} to authorize one profile-nudge event.`)
}

const inngest = new Inngest({
  id: 'scholars-test-trigger',
  eventKey,
})

const eventId = `manual-profile-nudge-test:${deliveryId}:${Date.now()}`
const result = await inngest.send({
  name: EVENT_NAME,
  id: eventId,
  data: {
    deliveryId,
    correlationId: eventId,
  },
})

console.log(JSON.stringify({
  ok: true,
  eventName: EVENT_NAME,
  eventId,
  deliveryId,
  result,
}, null, 2))
