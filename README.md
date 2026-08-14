# Anatomapp

Статическое Telegram Mini App с серверными функциями Vercel для безопасного входа и хранения прогресса в Supabase.

## Настройка

1. Выполните `supabase/telegram-storage.sql` в Supabase SQL Editor.
2. Добавьте в Vercel переменные из `.env.example`:
   - `TELEGRAM_BOT_TOKEN` — токен `@Vmeda_anatom_bot`;
   - `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API;
   - `SESSION_SECRET` — случайная строка длиной не менее 32 байт;
   - `ADMIN_TELEGRAM_IDS` — Telegram ID администраторов через запятую.
   - `ADMIN_EMAILS` — email администраторов через запятую (необязательно; по умолчанию используется текущий email владельца).
3. В BotFather задайте production-домен Vercel через `/setdomain` и URL Mini App через `/setmenubutton` или настройки приложения.
4. Выполните новое production-развёртывание после добавления переменных.

`SUPABASE_SERVICE_ROLE_KEY`, токен бота и `SESSION_SECRET` нельзя добавлять в `index.html` или коммитить в Git.

## Что сохраняется

- Telegram ID, имя, username, язык, Premium-статус, даты регистрации и активности;
- курс и факультет;
- XP, серия дней и история обучения;
- прогресс по темам, ошибки, избранное и заметки.

Администратор видит только сводные учебные показатели. Содержимое пользовательских заметок через админ-панель не передаётся.

Локальное хранилище используется как офлайн-кэш, а `/api/state` синхронизирует данные с Supabase после подтверждённого Telegram-входа.
