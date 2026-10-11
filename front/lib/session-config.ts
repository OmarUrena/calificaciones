// Cambia estos valores para ajustar la política de inactividad de la aplicación.
export const SESSION_IDLE_MINUTES = 15;
export const SESSION_WARNING_AFTER_MINUTES = 2;

export const SESSION_IDLE_MS = SESSION_IDLE_MINUTES * 60_000;
export const SESSION_WARNING_AT_MS = SESSION_WARNING_AFTER_MINUTES * 60_000;
export const SESSION_LAST_ACTIVITY_KEY = "califapp_last_activity";
