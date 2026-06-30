exports.handler = async function(event, context) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      vapidKey: process.env.FCM_VAPID_KEY || null,
      fcmEnabled: false
    })
  };
};
