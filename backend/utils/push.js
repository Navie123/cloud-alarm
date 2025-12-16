const webpush = require('web-push');
const Device = require('../models/Device');

// Configure web-push
const configurePush = () => {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

// Send push notification to all subscriptions for a device
const sendPushNotification = async (deviceId, payload) => {
  try {
    // Find device with push subscriptions
    const device = await Device.findOne({ deviceId });
    
    if (!device || !device.pushSubscriptions || device.pushSubscriptions.length === 0) {
      console.log(`No push subscriptions for device ${deviceId}`);
      return;
    }

    const notifications = [];

    for (const subscription of device.pushSubscriptions) {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      };

      notifications.push(
        webpush.sendNotification(pushSubscription, JSON.stringify(payload))
          .catch(error => {
            console.error('Push notification error:', error);
            // Remove invalid subscription
            if (error.statusCode === 410 || error.statusCode === 404) {
              device.pushSubscriptions = device.pushSubscriptions.filter(
                s => s.endpoint !== subscription.endpoint
              );
              device.save();
            }
          })
      );
    }

    await Promise.allSettled(notifications);
    console.log(`Sent ${notifications.length} push notifications for device ${deviceId}`);
  } catch (error) {
    console.error('Send push error:', error);
  }
};

module.exports = { configurePush, sendPushNotification };
