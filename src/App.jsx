import React, { useState, useEffect } from 'react';
import Onboarding from './components/Onboarding.jsx';
import Chat from './components/Chat.jsx';

export default function App() {
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  useEffect(() => {
    async function cargar() {
      const p = await window.ryu.storeGet('perfil');
      const apiKey = await window.ryu.storeGet('apiKey');
      if (p && apiKey) setPerfil(p);
      setCargando(false);
    }
    cargar();
  }, []);

  if (cargando) {
    return (
      <div className="splash">
        <span className="cyan">RYU</span>
      </div>
    );
  }

  if (!perfil) {
    return <Onboarding onComplete={p => { setPerfil(p); setEditandoPerfil(false); }} />;
  }

  if (editandoPerfil) {
    return (
      <Onboarding
        editMode
        perfilActual={perfil}
        onComplete={p => { setPerfil(p); setEditandoPerfil(false); }}
      />
    );
  }

  return (
    <Chat
      perfil={perfil}
      onEditarPerfil={() => setEditandoPerfil(true)}
    />
  );
}
