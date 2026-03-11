# 🐍 Anaconduit

**The Modern Xray Core Management Engine** *Простая, быстрая и надежная панель управления инфраструктурой Xray на базе Docker.*

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Framework-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react)](https://reactjs.org/)

**Anaconduit** — это не просто панель, это экосистема для управления вашим прокси-сервером. Мы объединили мощь **Xray Core**, гибкость **Nginx** и простоту **Docker**, обернув всё это в современный интерфейс, который не тормозит.



## ✨ Основные возможности

* 🚀 **Развертывание в одну команду** — забудьте о ручной правке конфигов.
* 🐋 **Docker-Native** — все компоненты изолированы. Система остается чистой.
* 🛡️ **Smart Gateway** — встроенное управление Nginx (start/restart/apply) с мониторингом статуса.
* 📊 **Live-логи** — универсальный терминал с подсветкой синтаксиса для Xray и Nginx.
* ⚡ **Real-time мониторинг** — отслеживание скорости клиентов и общего трафика в реальном времени.
* 🧩 **Управление протоколами** — поддержка VLESS, gRPC, XTLS-Vision и гибкая настройка инбаундов.
* 🔒 **Безопасность из коробки** — автоматическая настройка UFW и мониторинг открытых портов.

## 🚀 Быстрый старт

Для установки на чистый сервер (Ubuntu 20.04+ / Arch Linux) выполните:

```bash
sudo bash -c "$(curl -sL [https://github.com/anaconduit-dev/anaconduit-script/raw/main/install.sh](https://github.com/anaconduit-dev/anaconduit-script/raw/main/install.sh))" @ install

🛠 Технологический стек

    Backend: Python 3.10+, FastAPI, Docker SDK.

    Frontend: React 18, TypeScript, Tailwind CSS, Lucide Icons.

    Proxy: Xray Core (VLESS, Vmess, Trojan, etc.).

    Web Server: Nginx (как шлюз и стриминг-прокси).

📂 Структура проекта

    Anaconduit API: Обработка логики, управление Docker-контейнерами и генерация конфигов.

    Anaconduit UI: Реактивный интерфейс для управления пользователями и сервисами.

    Anaconduit Script: Bash-инструментарий для деплоя и первичной настройки ОС.

🚧 Roadmap

    [ ] Интеграция Telegram-бота для уведомлений.

    [ ] Поддержка нескольких узлов (Multi-node).

    [ ] Автоматическое получение SSL-сертификатов (Certbot/Let's Encrypt).

    [ ] Расширенная статистика по дням/месяцам.

🤝 Контрибьютинг

Мы рады любой помощи! Если вы нашли баг или хотите предложить фичу:

    Форкните репозиторий.

    Создайте ветку (git checkout -b feature/AmazingFeature).

    Закоммитьте изменения (git commit -m 'Add AmazingFeature').

    Откройте Pull Request.
