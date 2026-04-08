import React, { useState } from 'react';

export default function TokenCounter({ tokens, modelo }) {
  const [expandido, setExpandido] = useState(false);

  const esHaiku = modelo?.includes('haiku');
  const costoInput = esHaiku ? 0.80 : 3.0;
  const costoOutput = esHaiku ? 4.0 : 15.0;
  const costoTotal = (tokens.input * costoInput + tokens.output * costoOutput) / 1_000_000;

  return (
    <div className="token-counter" onClick={() => setExpandido(e => !e)}>
      <span className="gray">
        {tokens.mensajes}msg · ${costoTotal.toFixed(4)}
      </span>

      {expandido && (
        <div className="token-popup">
          <div className="token-popup-row">
            <span className="gray">Input</span>
            <span className="white">{tokens.input.toLocaleString()}</span>
          </div>
          <div className="token-popup-row">
            <span className="gray">Output</span>
            <span className="white">{tokens.output.toLocaleString()}</span>
          </div>
          <div className="token-popup-row">
            <span className="gray">Total</span>
            <span className="cyan">{(tokens.input + tokens.output).toLocaleString()}</span>
          </div>
          <div className="token-popup-sep" />
          <div className="token-popup-row">
            <span className="gray">Costo sesión</span>
            <span className="green">${costoTotal.toFixed(5)} USD</span>
          </div>
          <div className="token-popup-row">
            <span className="gray">Modelo</span>
            <span className="yellow">{esHaiku ? 'Haiku' : 'Sonnet'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
