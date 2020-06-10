const yargs = require('yargs')
const path = require('path')
const { argv } = yargs
const _ = require('lodash')
const fs = require('fs')
const superagent = require('superagent')
const braveJoi = require('./extras-joi')
const Joi = require('@hapi/joi')
const txValidator = Joi.object().keys({
  executedAt: braveJoi.date().iso().optional().description('the timestamp the settlement was executed'),
  owner: braveJoi.string().owner().required().description('the owner identity'),
  publisher: braveJoi.string().publisher().when('type', { is: Joi.string().valid('manual'), then: Joi.optional().allow(''), otherwise: Joi.required() }).description('the publisher identity'),
  address: Joi.string().required().description('settlement address'),
  altcurrency: braveJoi.string().altcurrencyCode().required().description('the altcurrency'),
  probi: braveJoi.string().numeric().required().description('the settlement in probi'),
  fees: braveJoi.string().numeric().default('0.00').description('processing fees'),
  currency: braveJoi.string().anycurrencyCode().default('USD').description('the deposit currency'),
  amount: braveJoi.string().numeric().required().description('the amount in the deposit currency'),
  commission: braveJoi.string().numeric().default('0.00').description('settlement commission'),
  fee: braveJoi.string().numeric().default('0.00').description('fee in addition to settlement commission'),
  transactionId: Joi.string().guid().required().description('the transactionId'),
  type: Joi.string().valid('contribution', 'referral', 'manual').default('contribution').description('settlement input'),
  hash: Joi.string().required().description('settlement-identifier')
}).unknown(true)
const txsValidator = Joi.array().min(1).items(txValidator).required().description('publisher settlement report')

main().catch(console.error)

async function main () {
  const { file, auth, url } = argv
  let filesArray = file.split(',')
  const agent = superagent.agent(url)
  let output = {}
  for (let fi = 0; fi < filesArray.length; fi += 1) {
    const file = filesArray[fi]
    const filepath = path.join(__dirname, file)
    console.log('parsing', filepath)
    const json = JSON.parse(fs.readFileSync(filepath).toString())
    const rejected = []
    const needsSettlement = json.reduce((memo, item) => {
      if (item.currency) {
        memo.push(item)
      } else {
        rejected.push(item)
      }
      return memo
    }, [])
    const { error, value } = txsValidator.validate(needsSettlement)
    if (error) {
      return console.log('error', error.toString())
    }
    console.log('total', json.length)
    console.log('filtered', value.length)
    console.log('rejected', rejected.length)
    writeAlternativeFile('filtered', file, value)
    writeAlternativeFile('rejected', file, rejected)
    const groupSize = 1000
    let groupIndex = 0
    while (value[groupIndex * groupSize]) {
      const increased = groupIndex + 1
      const start = groupIndex * groupSize
      const end = increased * groupSize
      const payload = value.slice(start, end)
      groupIndex = increased
      console.log(`sending... length: ${payload.length} indices ${start} to ${Math.min(value.length, end)}`)
      // const body = {}
      // for (let i = 0; i < payload.length; i += 1) {
      //   var item = payload[i]
      //   const list = body[item.type] || []
      //   body[item.type] = list
      //   if (!list.includes(item.transactionId)) {
      //     list.push(item.transactionId)
      //   }
      // }
      const {
        body
      } = await superagent.post(url + 'v2/publishers/settlement')
        .use(setHeaders(auth))
        .send(payload)

      output = merge(output, body)
    }
  }
  // return
  console.log('submitting', output)
  await agent.post(url + 'v2/publishers/settlement/submit')
    .use(setHeaders(auth))
    .send(output)
}

function writeAlternativeFile(prefix, file, object) {
  const pathway = file.split('/')
  pathway[pathway.length-1] = `${prefix}-${pathway[pathway.length-1]}`
  fs.writeFileSync(pathway.join('/'), JSON.stringify(object))
}

function setHeaders(auth) {
  return (req) => {
    return req.set('Authorization', `Bearer ${auth}`).set('Accept', 'application/json').set('Content-Type', 'application/json')
  }
}

function merge(a, b) {
  return _.merge(a, b, customizer)

  function customizer(objValue, srcValue) {
    if (_.isArray(objValue)) {
      return _.uniq(objValue.concat(srcValue))
    }
  }
}