<script setup lang="ts">
import { useAvantioSession } from '@/composables/useAvantioSession'

const { showModal, status, error, email, password, tfaCode, submitting, submitCredentials, submit2FA, cancel } = useAvantioSession()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showModal" class="av-backdrop" @click.self="cancel">
        <div class="av-card">
          <div class="av-logo">
            <img src="/avantio-logo.svg" alt="Avantio" />
          </div>

          <h3 class="av-heading">{{ status === 'needs_2fa' ? 'VERIFICACION' : 'LOGIN' }}</h3>

          <p v-if="error" class="av-error">{{ error }}</p>

          <template v-if="status === 'needs_login'">
            <div class="av-fields">
              <input v-model="email" type="email" class="av-input" placeholder="User's email" :disabled="submitting" @keyup.enter="submitCredentials" />
              <input v-model="password" type="password" class="av-input" placeholder="Password" :disabled="submitting" @keyup.enter="submitCredentials" />
            </div>
            <button class="av-btn" @click="submitCredentials" :disabled="submitting">
              <span v-if="submitting" class="spinner spinner--small spinner--white"></span>
              {{ submitting ? 'LOGGING IN...' : 'LOGIN' }}
            </button>
            <button class="av-cancel" @click="cancel" :disabled="submitting">Cancelar</button>
          </template>

          <template v-else-if="status === 'needs_2fa'">
            <p class="av-desc">Ingresá el código de verificación de tu app de autenticación.</p>
            <div class="av-fields">
              <input v-model="tfaCode" type="text" class="av-input" placeholder="Verification code" inputmode="numeric" autocomplete="one-time-code" :disabled="submitting" @keyup.enter="submit2FA" />
            </div>
            <button class="av-btn" @click="submit2FA" :disabled="submitting">
              <span v-if="submitting" class="spinner spinner--small spinner--white"></span>
              {{ submitting ? 'VERIFYING...' : 'VERIFY' }}
            </button>
            <button class="av-cancel" @click="cancel" :disabled="submitting">Cancelar</button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.av-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.av-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 420px;
  margin: 16px;
  padding: 40px 48px 32px;
  text-align: center;
}
.av-logo { margin-bottom: 16px; }
.av-logo img { height: 48px; width: auto; }
.av-heading {
  margin: 0 0 24px;
  font-size: 1rem;
  font-weight: 400;
  color: #999;
  letter-spacing: 2px;
}
.av-desc {
  font-size: 0.88rem;
  color: #888;
  margin: -8px 0 20px;
  line-height: 1.5;
}
.av-error {
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0 0 16px;
  padding: 10px 14px;
  background: #fdf0ef;
  border-radius: 4px;
  text-align: left;
}
.av-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
  text-align: left;
}
.av-input {
  padding: 14px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.95rem;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.2s;
  color: #333;
}
.av-input::placeholder { color: #bbb; font-weight: 300; }
.av-input:focus {
  outline: none;
  border-color: #5bbad5;
  box-shadow: 0 0 0 2px rgba(91, 186, 213, 0.25);
}
.av-input:disabled { opacity: 0.5; cursor: not-allowed; background: #f9f9f9; }
.av-btn {
  width: 100%;
  padding: 14px;
  background: #d4553a;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  cursor: pointer;
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.av-btn:hover:not(:disabled) { background: #c04a32; }
.av-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.av-cancel {
  width: 100%;
  padding: 10px;
  background: none;
  color: #aaa;
  border: none;
  font-size: 0.85rem;
  cursor: pointer;
  margin-top: 12px;
}
.av-cancel:hover { color: #c0392b; }
.av-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner--white { border-color: rgba(255,255,255,0.3); border-top-color: #fff; }
.spinner--small { width: 18px; height: 18px; border-width: 2px; }
.modal-enter-active { transition: opacity 0.2s ease; }
.modal-enter-active .av-card { transition: transform 0.2s ease, opacity 0.2s ease; }
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-leave-active .av-card { transition: transform 0.15s ease, opacity 0.15s ease; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .av-card { transform: scale(0.95) translateY(10px); opacity: 0; }
.modal-leave-to { opacity: 0; }
.modal-leave-to .av-card { transform: scale(0.95) translateY(10px); opacity: 0; }
</style>
