
# 🐍 Anaconduit

**The Modern Xray Core Management Engine** *Панель управления инфраструктурой Xray на базе Docker, FastAPI и React.*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Framework-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react)](https://reactjs.org/)

**Anaconduit** — это современное решение для управления прокси-серверами. Мы отказались от классических сложных схем в пользу чистого Docker-окружения, где Nginx выступает единым шлюзом, обеспечивая максимальную скрытность и безопасность ваших соединений.



## ✨ Ключевые особенности

* 🚀 **Развертывание в одну команду** — полная автоматизация настройки сервера с нуля.
* 🐋 **Docker-Native** — изоляция API, UI и Xray Core. Ваша хост-система остается чистой.
* 🛡️ **Безопасность по умолчанию** — автоматическая настройка **UFW** (открыты только 22, 80, 443) и защита от брутфорса.
* 🔒 **Nginx Stealth Gateway** — все инбаунды работают через 443 порт. Трафик скрыт за стандартным HTTPS.
* 🔄 **Zero-Maintenance SSL** — автоматическое продление сертификатов Let's Encrypt через Cron с управлением жизненным циклом контейнеров.
* 📊 **Universal Log Terminal** — живой просмотр логов Nginx и Xray с умной подсветкой статус-кодов и ошибок.

## 🚀 Быстрый старт (Installation)

Для развертывания Anaconduit вам потребуется чистый сервер с Ubuntu 22.04/24.04 или Arch Linux, а также два подготовленных домена.
1. Предварительные требования (Pre-requisites)

Перед запуском скрипта убедитесь, что у вас есть:

 * Основной домен (Panel): Используется для доступа к админ-панели и выдачи SSL. (например, manage.yourdomain.com)

 * Reality домен (Mask): Используется как маскировка для Xray. (например, content.yourdomain.com или любой популярный иностранный ресурс).

 * Порты: Убедитесь, что порты 80 и 443 свободны и открыты в Firewall (UFW/iptables).

2. Установка (One-line Install)

Запустите команду установки. Скрипт автоматически установит Docker, настроит Nginx и подготовит конфигурации Xray:

```bash
sudo bash -c "$(curl -sL [https://github.com/anaconduit-dev/anaconduit-script/raw/main/install.sh](https://github.com/anaconduit-dev/anaconduit-script/raw/main/install.sh))" @ install
```
## 🛠 Технологический стек

* Backend: Python 3.10+, FastAPI, Docker SDK.

* Frontend: React 18, TypeScript, Tailwind CSS, Lucide Icons.

* Proxy Core: Xray Core (VLESS, gRPC, XTLS-Vision).

* Web Server: Nginx (Reverse Proxy & SSL Offloading).

## 🛡️ Архитектура сети и безопасность

# Anaconduit придерживается принципа "минимальной поверхности атаки":

* Единая точка входа: Весь внешний трафик принимает Nginx на портах 80/443.

* Внутренняя сеть: Контейнеры API и Xray Core общаются внутри изолированной сети Docker.

* Закрытые порты: Благодаря проксированию через Nginx, нет необходимости открывать дополнительные порты в UFW для каждого инбаунда.



## 🚧 Roadmap
* [ ] Интеграция Telegram-бота для управления и уведомлений.

* [ ] Multi-node: управление несколькими серверами из одной панели.

* [ ] Расширенная аналитика потребления трафика по дням.

* [ ] Модуль автоматической очистки логов и оптимизации БД.
