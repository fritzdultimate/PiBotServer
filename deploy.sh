#!/bin/bash

cd /root/PiBotServer || exit 1
git reset --hard
git pull origin main

echo "Restarting bot..."
pm2 restart pibot

echo "Restarting Telegram bot...."
pm2 restart bot
