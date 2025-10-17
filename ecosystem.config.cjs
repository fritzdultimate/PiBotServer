module.exports = {
  apps: [{
    name: "mainServer",
    script: "./server.js",
    cwd: "/root/PiBotServer",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      MONGODB_URI: "mongodb://pibotuser:PibotAppPass%402025@127.0.0.1:27017/pibot?authSource=pibot"
    }
  }]
}
EOF
