@echo off
title English Datpmt - Personal Edition
chcp 65001 >nul
echo =======================================================
echo   ENGLISH DATPMT - PHIÊN BẢN HỌC CÁ NHÂN (AI POWERED)
echo =======================================================
echo.
echo Đang kiểm tra thư viện...
if not exist node_modules (
    echo Đang cài đặt thư viện cần thiết...
    call npm.cmd install
)

echo.
echo Đang khởi động Server tại http://localhost:3000...
echo Trình duyệt sẽ tự động mở sau 2 giây...
timeout /t 2 /nobreak >nul
start http://localhost:3000

node server.js
pause
