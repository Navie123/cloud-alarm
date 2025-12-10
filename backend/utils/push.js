const webpush = require('web-push');
const User = require('../models/User');

// Configure web-push
const configurePush = () => {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
};

// Send push notification to all users subscribed to a device
const sendPushNotification = async (deviceId, payload) => {
  try {
    // Find all users with push subscriptions
    const users = await User.find({
      'pushSubscriptions.0': { $exists: true }
    });

    const notifications = [];

    for (const user of users) {
      for (const subscription of user.pushSubscriptions) {
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
                user.pushSubscriptions = user.pushSubscriptions.filter(
                  s => s.endpoint !== subscription.endpoint
                );
                user.save();
              }
            })
        );
      }
    }

    await Promise.allSettled(notifications);
    console.log(`Sent ${notifications.length} push notifications for device ${deviceId}`);
  } catch (error) {
    console.error('Send push error:', error);
  }
};

module.exports = { configurePush, sendPushNotification };
