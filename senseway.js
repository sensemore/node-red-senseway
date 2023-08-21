const mqtt = require("mqtt");
const uuid = require("uuid");

module.exports = function (RED) {
  function SensewayNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    if (!config.gatewayMac) {
      node.error("Gateway MAC address is required");
      node.status({ fill: "red", shape: "dot", text: "missing config" });
      return;
    }

    if (!config.deviceMac) {
      node.error("MQTT URI is required");
      node.status({ fill: "red", shape: "dot", text: "missing config" });
      return;
    }

    if (!config.mqttUri) {
      node.error("MQTT URI is required");
      node.status({ fill: "red", shape: "dot", text: "missing config" });
      return;
    }

    node.status({ fill: "yellow", shape: "dot", text: "connecting" });

    const client = mqtt.connect(config.mqttUri, {
      username: config.mqttUsername,
      password: config.mqttPassword,
    });

    client.on("connect", function () {
      node.status({ fill: "green", shape: "dot", text: "connected" });
      node.log("MQTT connected");

      client.subscribe(
        `prod/gateway/${config.gatewayMac}/device/${config.deviceMac}/measure/+/done`,
        function (err) {
          if (err) {
            node.error("MQTT subscription error");
          }
        }
      );
      client.subscribe(
        `lake/gateway/${config.gatewayMac}/device/${config.deviceMac}/measure/+/done`,
        function (err) {
          if (err) {
            node.error("MQTT subscription error");
          }
        }
      );
      node.log("MQTT subscribed");

      const intervalSeconds = config.intervalSeconds;
      
      if (
        config.accelerometerRangeIndex != 0 &&
        config.samplingRateIndex != 0 &&
        config.sampleSize != 0 &&
        config.intervalSeconds != 0
      ) {
        const publishMeasurementMessage = setInterval(() => {
          const measureId = uuid.v4().replace(/-/g, "").slice(0, 24);

          client.publish(
            `prod/gateway/${config.gatewayMac}/device/${config.deviceMac}/measure/${measureId}`,
            `${config.accelerometerRangeIndex},
              ${config.samplingRateIndex},
                ${config.sampleSize}`
          );
          client.publish(
            `lake/gateway/${config.gatewayMac}/device/${config.deviceMac}/measure/${measureId}`,
            `${config.accelerometerRangeIndex},
              ${config.samplingRateIndex},
                ${config.sampleSize}`
          );
          node.log(`MQTT message published: ${measureId}`);
        }, config.intervalSeconds * 1000);

        if(intervalSeconds != config.intervalSeconds) {
          clearInterval(publishMeasurementMessage);
        }
      }
    });

    client.on("message", function (topic, message) {
      const telemetries = JSON.parse(message.toString()).TELEMETRY;

      node.log(`MQTT message received: ${topic}`);
      node.send({
        topic: topic,
        payload: telemetries,
      });
    });

    client.on("error", function () {
      node.status({ fill: "red", shape: "dot", text: "error" });
      node.error("MQTT error");
    });

    client.on("close", function () {
      node.status({ fill: "red", shape: "dot", text: "closed" });
      node.error("MQTT connection closed");
    });

    client.on("offline", function () {
      node.status({ fill: "red", shape: "dot", text: "offline" });
      node.error("MQTT connection offline");
    });
  }

  RED.nodes.registerType("senseway", SensewayNode);
};
