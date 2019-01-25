const argv = require('minimist')(process.argv.slice(2))
const async = require('async')
const _ = require('lodash')
const { spawn } = require('child_process');
const geoip = require('geoip-lite');

const domain = _.get(argv, 'domain', 'media.admiralcloud.com')
const maxHops =_.get(argv, 'maxHops', 20)
const waitTime = _.get(argv, 'waitTime', 5)

if (_.get(argv, 'help')) {
  console.log('SHOWING HELP')
  console.log('')
  console.log('Usage: node index.js --domain DOMAIN --maxHops NUMBER --waitTime NUMBER')
  console.log('')
  console.log('--domain Domain name to use')
  console.log('--maxHops Number of hops to use, defaults to 20')
  console.log('--waitTime time to wait before a router is considered not reachable. Defaults to 5')
  console.log('')
  process.exit(0)
}

async.series({
  collectIPs: (done) => {
    const ls = spawn('host', [domain]);
    const regex = /(\d{1,3}\.){3}(\d{1,3})/g
    ls.stdout.on('data', (data) => {
      ips = data.toString().match(regex)
    });
    
    ls.stderr.on('data', (data) => {
      return done({ message: 'collectIPs_failed', additionalInfo: data })
    });
    
    ls.on('close', done)
  },
  traceIP: (done) => {
    const targetIP = _.first(ips)
    console.log('This is your route to %s (%s) - using %s hops and %s seconds waitTime', targetIP, domain, maxHops, waitTime)
    console.log('')
    console.log(_.padEnd('ISO', 5), _.padEnd('IP', 18), _.padEnd('RTT in ms', 20))
    console.log(_.repeat('-', 70))

    const regex = /((\d{1,3}.){1,3}\d{1,3})/ig
    const args = ['-d', '-q', 1, '-m', maxHops, '-w', waitTime, '-n', targetIP];
    const traceroute = spawn('traceroute', args);

    traceroute.stdout.on('data', (data) => {
      let locRegex = data.toString().match(regex)
      if (locRegex) {
        let ip = _.first(locRegex)
        let rtt = _.last(locRegex)
        var geo = geoip.lookup(ip);
        //console.log(geo)
        console.log(_.padEnd(_.get(geo, 'country'), 5), _.padEnd(ip, 18), _.padEnd(rtt, 20), _.padEnd(_.get(geo, 'city'), 20), _.padEnd(_.get(geo, 'region'), 10))
      }
      else {
        console.log('*')
      }
    })

    traceroute.stderr.on('data', (data) => {
      //console.log(33, data.toString())
    })


    traceroute.on('close', (code) => {
      console.log(_.repeat('-', 70))
      console.log("Traceroute finished with code %s", code)
      return done()
    })
  }
}, (err) => {
  if (err) console.error(err)
  process.exit(0)
})
