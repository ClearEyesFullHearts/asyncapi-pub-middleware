# asyncapi-pub-middleware
Add a validating publisher object, from an AsyncAPI file description, to your request

## Summary
This module will automatically adds a validating publisher object (RabbitMQ, Kafka or HTTP) to the request of your express-like application, from an [AsyncAPI](https://www.asyncapi.com/docs/reference/specification/v2.6.0) definition file.

# Usage
```javascript
const server = require('express');
const getPublisherMiddleware = require('asyncapi-pub-middleware');

const app = server();

const doc = fs.readFileSync('./myAsyncAPIFile.yaml', 'utf8');

const options = {
  tag: 'my-app',
  connections: {},
};
const plugins = {
  mqtt: './plugins/mqtt',
}

const mountPublisher = await getPublisherMiddleware(doc, options, plugins);
app.use(mountPublisher);

// your middlewares

app.use(async (err, req, res, next) => {
  await req.api.publisher.publish('service.error', err);
  next(err);
});

app.listen(options);
```
This will validate and parse your AsyncAPI file (`myAsyncAPIFile.yaml`), then create a middleware that mount a publisher object. The validation and parsing of the file is done by [@asyncapi/parser](https://www.npmjs.com/package/@asyncapi/parser).  
This publisher object allows you to publish all messages defined as a subscribe operation in the asyncAPI file. On publishing it validates the parameters, headers and payload sent. The validation itself is done by [ajv](https://www.npmjs.com/package/ajv).  
  
Important Note: for this module to work you need to have 'servers' described in the spec and at least one of these servers attached to each of the 'channels'

# Documentation
## asyncapi-pub-middleware
The main function just create a Publisher object from an asyncAPI spec file with the options passed and attach it to the request object.  
## Publisher
```javascript
class Publisher {
  constructor(plugins = {})
  async loadAPI(apiDocument, options = {})
  async publish(topic, msg, headers = {}, options = {})
  async stop(closeConnection = true)
}
```
The publisher class itself it available out of the middleware for your convenience
```javascript
const Publisher = require('asyncapi-pub-middleware').Publisher;
const publisher = new Publisher();
```
### `constructor(plugins = {})`
For the moment only those protocol are taken care of
- amqp, using [amqplib](https://www.npmjs.com/package/amqplib).
- kafka, using [KafkaJS](https://kafka.js.org/docs/getting-started).  
- http, using [Axios](https://www.npmjs.com/package/axios).
  
You can add other protocols or overwrite existing ones by passing a path to a protocol plugin file into the Publisher constuctor:
```javascript
const Publisher = require('asyncapi-pub-middleware').Publisher;
const publisher = new Publisher({
  amqp: './plugins/amqp',
  kafka: './plugins/kafka',
});
```
### `async loadAPI(apiDocument, options = {})`
This function loads the spec file and create a Channel object for each 'channel' in the spec file that has a 'subscribe' operation. This Channel object will be used for publishing messages to the defined 'channel'.  
If no connection is provided (see options) it will try to create the connection itself from the 'servers' definitions in the spec file.  
#### `apiDocument`
The AsyncAPI file. It accepts 3 formats:  
  
`string` (reading directly from the file)  
```javascript
const document = fs.readFileSync('./lib/myAsyncAPIFile.yaml', 'utf8');
```
`JSON` (the file converted to a JSON object) 
```javascript
const yaml = require('js-yaml');
const document = yaml.load(fs.readFileSync('./lib/myAsyncAPIFile.yam', 'utf8'));
```
`AsyncAPIDocument` (the file parsed through [@asyncapi/parser](https://www.npmjs.com/package/@asyncapi/parser)) 
```javascript
const { parse } = require('@asyncapi/parser');
const document = await parse(fs.readFileSync('./lib/myAsyncAPIFile.yam', 'utf8'));
```
#### `options`
An optional object. All properties are optional too.  
```javascript
// these are the default values
const {
  tag = '',
  connections = {},
} = options;
```
If `tag` is set, only the tagged subscribe operations will be available for publishing.  
`connections` is an object containing the connections to the servers. It is highly recommended that you create the connections yourself, mostly to take care of the security part. The automatic connection creation in the plugins is mostly there for convenience in development.  
If your asyncAPI file defines servers like that:
```
servers:
  rabbit:
    url: amqp://myuser:mypassword@localhost:5672
    protocol: amqp
    protocolVersion: 0.9.1
  kafkaBroker:
    url: localhost:19092
    protocol: kafka
  RESTServer:
    url: localhost:8080
    protocol: http
```
Your connection object should look like that:    
```javascript
const { Kafka } = require('kafkajs');
const amqplib = require('amqplib');
const axios = require('axios');

// Actual connection from amqplib for amqp protocol
const rabbitConn = await amqplib.connect('amqp://myuser:mypassword@localhost:5672');

const kafka = new Kafka({
  brokers: ['localhost:19092'],
});

// Producer connection from KafkaJS for kafka protocol
const kafkaProducer = kafka.producer();
await kafkaProducer.connect();

// Axios instance for http protocol
const httpInstance = axios.create({
  baseURL: 'localhost:8080',
  headers: { 'Authorization': AUTH_TOKEN },
});

const options = {
  connections: {
    rabbit: rabbitConn, // name of the amqp protocol server in the spec
    kafkaBroker: kafkaProducer, // name of the kafka protocol server in the spec
    RESTServer: httpInstance, // name of the http protocol server in the spec
  },
};
```
### `async publish(topic, msg, headers = {}, options = {})`
This function will pick the Channel defined by the topic, validate the parameters, headers and message payload against the schema defined in the spec file and then ask the plugin to publish the message with the options.  
The `publish` function returns the result of the publish action if applicable (i.e. only for the http protocol), it will always be an array of results.  
```javascript
await publisher.publish('my.amqp.channel.name', { foo: 'bar' }, { 'x-session-id': 'myuuid' }, { priority: 25 });
await publisher.publish('my.kafka.channel.name', { foo: 'bar' }, { 'x-session-id': 'myuuid' }, { key: 'myKafkaKey', partition: 3 });
const [{ data, status, headers }] = await publisher.publish('/ping', { foo: 'bar' }, { 'x-session-id': 'myuuid' });
```
### `async stop(closeConnection = true)`
This function will close all channels and the underlying connection if it's asked and applicable.
```javascript
await publisher.stop(false);
```
  
## Plugins
Plugins are used for the actual publishing of the message.  
During the channels creation the result of `ProtocolConnection.getConnection(serverInfoFromSpec)` is fed to the ProtocolConnection constructor which is then bound, i.e. `protocol.bind(channelBindingsFromSpec, operationBindingsFromSpec)`.  
Plugins prototype:
```javascript
class ProtocolConnection {
  static async getConnection(serverInfoFromSpec);
  constructor(conn);
  async bind(channelBindingsFromSpec, operationBindingsFromSpec);
  async publish(topic, headers, msg, messageBindingsFromSpec, options = {});
  async stop(closeConnection = true)
}
```
