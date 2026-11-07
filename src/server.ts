import { crearApp } from './app';

try {
  process.loadEnvFile(); // lee .env (Node 22)
} catch {
  /* sin .env: se usan los valores por defecto */
}

const puerto = Number(process.env.PORT ?? 3000);
crearApp().listen(puerto, () => console.log(`API TelcoCore escuchando en http://localhost:${puerto}`));
