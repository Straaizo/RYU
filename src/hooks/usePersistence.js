import { useState, useEffect } from 'react';

export function usePersistence() {
  const [sesion, setSesion] = useState(null);

  useEffect(() => {
    async function cargar() {
      const s = await window.ryu.storeGet('sesion');
      if (s) setSesion(s);
    }
    cargar();
  }, []);

  async function guardarSesion(datos) {
    const nueva = { ...sesion, ...datos, updatedAt: Date.now() };
    setSesion(nueva);
    await window.ryu.storeSet('sesion', nueva);
  }

  async function limpiarSesion() {
    setSesion(null);
    await window.ryu.storeDelete('sesion');
  }

  return { sesion, guardarSesion, limpiarSesion };
}
