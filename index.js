const { argv } = require('yargs').config({
  file: {
    type: 'array',
    describe: 'the list of files to upload'
  },
  auth: {
    type: 'string',
    describe: 'the auth key to use'
  },
  url: {
    type: 'string',
    describe: 'the host to point to'
  }
})
const path = require('path')
const URL = require('url')
const _ = require('lodash')
const fs = require('fs')
const superagent = require('superagent')
const braveJoi = require('./extras-joi')
const Joi = require('joi')
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

function getFiles(files) {
  return (_.isString(files) ? [files] : files).reduce((memo, target) => {
    let targets = target
    if (fs.statSync(target).isDirectory()) {
      targets = fs.readdirSync(target).filter((file) =>
        file[0] !== '.'
      )
    }
    return memo.concat(targets.map((file) =>  path.join(__dirname, target, file)).filter((target) => !target.includes('/filtered-') && !target.includes('/rejected-')))
  }, [])
}

async function main () {
  const { file: filesList, auth, url } = argv
  const agent = superagent.agent(url)
  let output = {}
  const filesArray = getFiles(filesList)
  console.log("files", filesArray)
  for (let fi = 0; fi < filesArray.length; fi += 1) {
    const file = filesArray[fi]
    const filepath = file[0] === '/' ? file : path.join(__dirname, file)
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
      } = await agent.post(URL.resolve(url, 'v2/publishers/settlement'))
        .use(setHeaders(auth))
        .send(payload)

      output = merge(output, body)
    }
  }
}

function writeAlternativeFile(prefix, file, object) {
  const pathway = file.split('/')
  pathway[pathway.length-1] = `${prefix}-${pathway[pathway.length-1]}`
  fs.mkdirSync(path.join(__dirname, 'settlements'), { recursive: true })
  fs.writeFileSync(pathway.join('/'), JSON.stringify(object))
}

function setHeaders(auth) {
  return (req) => {
    return req.set('Authorization', `Bearer ${auth}`)
      .set('Accept', 'application/json')
      .set('Content-Type', 'application/json')
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