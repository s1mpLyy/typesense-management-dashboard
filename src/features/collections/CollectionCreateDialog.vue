<script setup lang="ts">
import { Plus, Trash2 } from '@lucide/vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import SelectButton from 'primevue/selectbutton';
import Textarea from 'primevue/textarea';
import { computed, ref, watch } from 'vue';
import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import {
  CollectionSchemaError,
  FIELD_TYPES,
  collectionDraftToSchema,
  emptyCollectionField,
  parseCollectionSchemaJson,
} from '@/features/collections/collectionSchema';
import type { CollectionDraft } from '@/features/collections/collectionSchema';

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  serverError?: string;
}>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
  submit: [schema: CollectionCreateSchema];
}>();

type EditorMode = 'Form' | 'JSON';

const modeOptions: EditorMode[] = ['Form', 'JSON'];
const fieldTypeOptions = [...FIELD_TYPES];
const mode = ref<EditorMode>('Form');
const draft = ref<CollectionDraft>(newDraft());
const jsonText = ref('');
const validationError = ref('');

const defaultSortOptions = computed(() => [
  { label: 'No default sorting field', value: '' },
  ...draft.value.fields
    .filter(
      (field) =>
        ['int32', 'int64', 'float'].includes(field.type) || (field.type === 'string' && field.sort),
    )
    .filter((field) => field.name.trim())
    .map((field) => ({ label: field.name, value: field.name })),
]);

function newDraft(): CollectionDraft {
  return {
    name: '',
    fields: [emptyCollectionField()],
    defaultSortingField: '',
    enableNestedFields: false,
  };
}

function draftJson(): string {
  return JSON.stringify(
    {
      name: draft.value.name,
      fields: draft.value.fields.map((field) => ({ ...field, index: true })),
      ...(draft.value.defaultSortingField
        ? { default_sorting_field: draft.value.defaultSortingField }
        : {}),
      enable_nested_fields: draft.value.enableNestedFields,
    },
    null,
    2,
  );
}

function reset(): void {
  mode.value = 'Form';
  draft.value = newDraft();
  jsonText.value = draftJson();
  validationError.value = '';
}

function addField(): void {
  draft.value.fields.push(emptyCollectionField());
}

function removeField(index: number): void {
  draft.value.fields.splice(index, 1);
  if (!draft.value.fields.length) addField();
}

function close(): void {
  if (!props.loading) emit('update:visible', false);
}

function submit(): void {
  validationError.value = '';
  try {
    const schema =
      mode.value === 'Form'
        ? collectionDraftToSchema(draft.value)
        : parseCollectionSchemaJson(jsonText.value);
    emit('submit', schema);
  } catch (error) {
    validationError.value =
      error instanceof CollectionSchemaError ? error.message : 'Check the collection schema.';
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) reset();
  },
);

watch(mode, (nextMode) => {
  validationError.value = '';
  if (nextMode === 'JSON') jsonText.value = draftJson();
});
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Create collection"
    class="collection-dialog"
    :closable="!loading"
    @update:visible="emit('update:visible', $event)"
  >
    <form id="collection-create-form" class="collection-form" novalidate @submit.prevent="submit">
      <SelectButton
        v-model="mode"
        :options="modeOptions"
        :allow-empty="false"
        aria-label="Editor mode"
      />

      <div
        v-if="validationError || serverError"
        class="inline-alert inline-alert--error"
        role="alert"
      >
        {{ validationError || serverError }}
      </div>

      <template v-if="mode === 'Form'">
        <label class="form-field">
          <span>Collection name</span>
          <InputText v-model="draft.name" autocomplete="off" placeholder="products" autofocus />
        </label>

        <div class="form-field">
          <span>Fields</span>
          <section
            v-for="(field, index) in draft.fields"
            :key="index"
            class="collection-field-editor"
          >
            <div class="collection-field-main">
              <label>
                <span>Field name</span>
                <InputText v-model="field.name" placeholder="title" />
              </label>
              <label>
                <span>Type</span>
                <Select v-model="field.type" :options="fieldTypeOptions" />
              </label>
              <Button
                v-tooltip.left="'Remove field'"
                type="button"
                text
                rounded
                severity="danger"
                :aria-label="`Remove field ${index + 1}`"
                @click="removeField(index)"
              >
                <Trash2 :size="17" />
              </Button>
            </div>
            <div class="collection-field-options">
              <label :for="`optional-${index}`">
                <Checkbox v-model="field.optional" :input-id="`optional-${index}`" binary />
                <span>Optional</span>
              </label>
              <label :for="`facet-${index}`">
                <Checkbox v-model="field.facet" :input-id="`facet-${index}`" binary />
                <span>Facet</span>
              </label>
              <label :for="`sort-${index}`">
                <Checkbox v-model="field.sort" :input-id="`sort-${index}`" binary />
                <span>Sortable</span>
              </label>
            </div>
          </section>
          <Button type="button" label="Add field" severity="secondary" outlined @click="addField">
            <template #icon><Plus :size="16" /></template>
          </Button>
        </div>

        <div class="collection-form-options">
          <label class="form-field">
            <span>Default sorting field</span>
            <Select
              v-model="draft.defaultSortingField"
              :options="defaultSortOptions"
              option-label="label"
              option-value="value"
            />
          </label>
          <label class="binary-field" for="nested-fields">
            <Checkbox v-model="draft.enableNestedFields" input-id="nested-fields" binary />
            <span>Enable nested fields</span>
          </label>
        </div>
      </template>

      <label v-else class="form-field">
        <span>Collection schema</span>
        <Textarea v-model="jsonText" class="schema-editor" rows="18" spellcheck="false" />
      </label>
    </form>

    <template #footer>
      <Button label="Cancel" severity="secondary" text :disabled="loading" @click="close" />
      <Button
        form="collection-create-form"
        type="submit"
        label="Create collection"
        :loading="loading"
      />
    </template>
  </Dialog>
</template>
