#!/bin/zsh
# Отправка сайта на GitHub частями (связь рвёт большой кусок, поэтому видео идут по одному).
# Запуск из папки сайта:  zsh tools/push.sh
# Можно запускать сколько угодно раз — продолжит с того места, где остановилось.
test -f spin-maksym.mp4 || { echo "Не та папка: запусти из папки сайта."; return 1 2>/dev/null || exit 1; }
git config http.postBuffer 157286400

push() {
  for try in 1 2 3 4 5; do
    echo "→ отправляю: $1 (попытка $try)"
    git push -u origin main 2>&1 | tail -1
    if [ "$(git ls-remote origin refs/heads/main 2>/dev/null | cut -f1)" = "$(git rev-parse HEAD)" ]; then
      echo "✓ на GitHub: $1"; return 0
    fi
    sleep 2
  done
  echo "✗ не получилось: $1 — запусти ещё раз"; return 1
}

push "то, что уже собрано" || exit 1
for f in *.mp4; do
  git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && continue
  git add -- "$f" && git commit -q -m "Видео: $f" && push "$f" || exit 1
done
git add -A
git diff --cached --quiet || { git commit -q -m "Остальные файлы" && push "остальные файлы" || exit 1; }
echo "ГОТОВО — всё на GitHub: https://github.com/aiavi111/shoro"
