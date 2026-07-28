<script setup lang="ts">
import { useImportStore } from '@/stores/import'
import { onUnmounted } from 'vue'

const store = useImportStore()

onUnmounted(() => {
  // Don't reset — let the store persist across navigation
})

const entityLabels: Record<string, string> = {
  properties: 'Propiedades',
  accommodations: 'Alojamientos',
  bookings: 'Reservas',
  rates: 'Tarifas',
  availability: 'Disponibilidad',
  owners: 'Propietarios',
  images: 'Imágenes',
  descriptions: 'Descripciones',
  services: 'Servicios',
  extras: 'Extras',
}

function getEntityLabel(key: string): string {
  return entityLabels[key] || key
}
</script>

<template>
  <div class="import">
    <h2 class="import__heading">Importar desde Avantio</h2>
    <p class="import__description">
      Importa propiedades, reservas y otros datos desde tu cuenta de Avantio.
    </p>

    <!-- Initial state: no session -->
    <div v-if="!store.status" class="import__start card">
      <p>Pulsa el botón para iniciar el proceso de importación. Se abrirá una sesión del
        navegador automatizado para conectarse a Avantio.</p>
      <button class="btn btn--primary btn--large" @click="store.startImport()">
        Iniciar importación
      </button>
      <p v-if="store.error" class="import__error">{{ store.error }}</p>
    </div>

    <!-- Active session -->
    <div v-else class="import__session card">
      <!-- Status header -->
      <div class="import__status" :class="`import__status--${store.status}`">
        <div class="import__status-indicator">
          <span
            v-if="store.isWaitingForLogin || store.isImporting"
            class="spinner"
          ></span>
          <span v-else-if="store.isDone || store.isLoggedIn" class="import__check">&#10003;</span>
          <span v-else-if="store.hasError" class="import__cross">&#10007;</span>
        </div>
        <div class="import__status-text">
          <strong>{{ store.statusText }}</strong>
          <span v-if="store.sessionId" class="import__session-id">
            Sesión: {{ store.sessionId.substring(0, 8) }}...
          </span>
        </div>
      </div>

      <!-- Waiting for login -->
      <div v-if="store.isWaitingForLogin" class="import__waiting">
        <p>Se ha iniciado un navegador automatizado. Inicia sesión en Avantio en la ventana del
          navegador que se ha abierto.</p>
        <p class="import__hint">El sistema detectará automáticamente cuando hayas iniciado sesión.</p>
      </div>

      <!-- Logged in — ready to run -->
      <div v-if="store.isLoggedIn" class="import__ready">
        <p>Conexión con Avantio establecida correctamente. Pulsa el botón para comenzar la
          importación de datos.</p>
        <button class="btn btn--success btn--large" @click="store.runImport()">
          Ejecutar importación
        </button>
      </div>

      <!-- Importing — show progress -->
      <div v-if="store.isImporting" class="import__progress">
        <p>La importación está en curso. Este proceso puede tardar varios minutos.</p>
        <div
          v-if="Object.keys(store.importResults).length > 0"
          class="import__results table-wrapper"
        >
          <table>
            <thead>
              <tr>
                <th>Entidad</th>
                <th>Importados</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(count, entity) in store.importResults" :key="entity">
                <td>{{ getEntityLabel(String(entity)) }}</td>
                <td>
                  <strong>{{ count }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Done -->
      <div v-if="store.isDone" class="import__done">
        <p>La importación ha finalizado correctamente.</p>
        <div
          v-if="Object.keys(store.importResults).length > 0"
          class="import__results table-wrapper"
        >
          <h4>Resumen de la importación</h4>
          <table>
            <thead>
              <tr>
                <th>Entidad</th>
                <th>Total importados</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(count, entity) in store.importResults" :key="entity">
                <td>{{ getEntityLabel(String(entity)) }}</td>
                <td>
                  <strong>{{ count }}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Error -->
      <div v-if="store.hasError" class="import__error-detail">
        <p>Se ha producido un error durante la importación.</p>
        <p v-if="store.error" class="import__error">{{ store.error }}</p>
      </div>

      <!-- Action buttons -->
      <div class="import__actions">
        <button
          v-if="store.isImporting"
          class="btn btn--danger"
          @click="store.stopImport()"
        >
          Detener
        </button>
        <button
          v-if="store.isDone || store.hasError"
          class="btn btn--primary"
          @click="store.reset()"
        >
          Nueva importación
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.import__heading {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.import__description {
  color: var(--color-text-secondary);
  margin-bottom: 24px;
}

.import__start {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  padding: 48px 32px;
}

.import__start p {
  max-width: 500px;
  color: var(--color-text-secondary);
}

.import__session {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.import__status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--radius-md);
  background: var(--color-background-soft);
}

.import__status--waiting_for_login {
  background: var(--color-primary-lighter);
  border-left: 4px solid var(--color-primary);
}

.import__status--logged_in {
  background: #e4f3ed;
  border-left: 4px solid var(--color-success);
}

.import__status--importing {
  background: var(--color-primary-lighter);
  border-left: 4px solid var(--color-primary);
}

.import__status--done {
  background: #e4f3ed;
  border-left: 4px solid var(--color-success);
}

.import__status--error {
  background: #fbeaea;
  border-left: 4px solid var(--color-error);
}

.import__status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.import__session-id {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-family: monospace;
}

.import__check {
  font-size: 1.4rem;
  color: var(--color-success);
  font-weight: 700;
}

.import__cross {
  font-size: 1.4rem;
  color: var(--color-error);
  font-weight: 700;
}

.import__waiting p,
.import__ready p,
.import__progress p,
.import__done p,
.import__error-detail p {
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.import__hint {
  font-size: 0.9rem;
  font-style: italic;
}

.import__results {
  margin-top: 16px;
}

.import__results h4 {
  font-weight: 600;
  margin-bottom: 12px;
}

.import__error {
  color: var(--color-error);
  font-weight: 500;
}

.import__actions {
  display: flex;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
</style>
