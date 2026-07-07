const authUser = {
  uid: "test-uid",
  email: "test@test.com",
  displayName: "Test User",
  photoURL: "https://test.com/photo.png",
  emailVerified: true,
  isAnonymous: false,
  providerData: [
    {
      providerId: "password",
      uid: "test@test.com",
      displayName: "Test User",
      email: "test@test.com",
      phoneNumber: null,
      photoURL: "https://test.com/photo.png"
    }
  ],
  stsTokenManager: {
    refreshToken: "test-refresh",
    accessToken: "test-access",
    expirationTime: Date.now() + 3600000
  },
  createdAt: Date.now().toString(),
  lastLoginAt: Date.now().toString(),
  apiKey: "test-api-key",
  appName: "[DEFAULT]"
};
console.log(JSON.stringify(authUser, null, 2));
