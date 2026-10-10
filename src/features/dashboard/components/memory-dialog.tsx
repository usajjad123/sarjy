import { FormDialog, type ActionDialogProps } from "./form-dialog";
export function MemoryDialog({ busy, error, runAction, onClose }: ActionDialogProps) {
  return (
    <FormDialog
      title="A little thing to remember."
      description="Give the preference a key. Reuse it to update it later."
      busy={!!busy}
      error={error}
      onClose={onClose}
      onSubmit={async (form) => {
        if (await runAction("remember_fact", { key: form.get("key"), value: form.get("value") }))
          onClose();
      }}
    >
      <label>
        Preference key
        <input name="key" required maxLength={60} placeholder="usual_yogurt_portion" />
      </label>
      <label>
        What should Sarjy remember?
        <input
          name="value"
          required
          maxLength={500}
          placeholder="I usually have 150g of Greek yogurt"
        />
      </label>
    </FormDialog>
  );
}
