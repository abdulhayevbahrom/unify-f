import { Button, Card, Form, Input, Spin, Upload, message } from 'antd';
import { Save, UploadCloud } from 'lucide-react';
import { useEffect } from 'react';
import BrandIdentity from '../../components/BrandIdentity';
import { ACCOUNTING_BRAND, BrandingSettings, UNIFY_BRAND } from '../../config/branding';
import {
  useGetBrandingSettingsQuery,
  useUpdateBrandingSettingsMutation,
  useUploadBrandLogoMutation,
} from '../../services/api';

type SettingsFormValues = {
  unify: { name: string; subtitle: string };
  accounting: { name: string; subtitle: string };
};

const brandLabels = {
  unify: 'IT kurslari brendi',
  accounting: 'Buxgalteriya kurslari brendi',
};

export default function SettingsPage() {
  const [form] = Form.useForm<SettingsFormValues>();
  const { data, isLoading } = useGetBrandingSettingsQuery();
  const [updateBranding, { isLoading: isSaving }] = useUpdateBrandingSettingsMutation();
  const [uploadLogo] = useUploadBrandLogoMutation();
  const settings: BrandingSettings = data || { unify: UNIFY_BRAND, accounting: ACCOUNTING_BRAND };

  useEffect(() => {
    form.setFieldsValue({
      unify: { name: settings.unify.name, subtitle: settings.unify.subtitle },
      accounting: { name: settings.accounting.name, subtitle: settings.accounting.subtitle },
    });
  }, [form, settings.accounting.name, settings.accounting.subtitle, settings.unify.name, settings.unify.subtitle]);

  async function handleSave(values: SettingsFormValues) {
    try {
      await updateBranding({
        unify: { ...values.unify, logoUrl: settings.unify.logoUrl },
        accounting: { ...values.accounting, logoUrl: settings.accounting.logoUrl },
      }).unwrap();
      message.success('Brending sozlamalari saqlandi');
    } catch (error) {
      const apiError = error as { data?: { message?: string } };
      message.error(apiError.data?.message || 'Sozlamalarni saqlab bo‘lmadi');
    }
  }

  function uploadProps(brand: 'unify' | 'accounting') {
    return {
      accept: 'image/png,image/jpeg,image/webp',
      showUploadList: false,
      customRequest: async ({ file, onSuccess, onError }: { file: string | Blob; onSuccess?: (body: unknown) => void; onError?: (error: Error) => void }) => {
        if (!(file instanceof File)) return;

        try {
          const result = await uploadLogo({ brand, file }).unwrap();
          onSuccess?.(result);
          message.success('Logo yuklandi');
        } catch (error) {
          const apiError = error as { data?: { message?: string } };
          const uploadError = new Error(apiError.data?.message || 'Logoni yuklab bo‘lmadi');
          onError?.(uploadError);
          message.error(uploadError.message);
        }
      },
    };
  }

  if (isLoading) return <Spin />;

  return (
    <section className="settings-page">
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <div className="settings-grid">
          {(['unify', 'accounting'] as const).map((brandKey) => (
            <Card key={brandKey} title={brandLabels[brandKey]} className="settings-brand-card">
              <div className="settings-brand-preview">
                <BrandIdentity brand={settings[brandKey]} variant="login" />
              </div>
              <Form.Item
                name={[brandKey, 'name']}
                label="Brend nomi"
                rules={[{ required: true, message: 'Brend nomini kiriting' }]}
              >
                <Input maxLength={100} />
              </Form.Item>
              <Form.Item name={[brandKey, 'subtitle']} label="Qo‘shimcha yozuv">
                <Input maxLength={160} />
              </Form.Item>
              <Upload {...uploadProps(brandKey)}>
                <Button icon={<UploadCloud size={17} />}>Logo yuklash</Button>
              </Upload>
              <p className="settings-upload-hint">PNG, JPG yoki WEBP, maksimal 5 MB</p>
            </Card>
          ))}
        </div>
        <Button type="primary" htmlType="submit" icon={<Save size={17} />} loading={isSaving}>
          Nomlarni saqlash
        </Button>
      </Form>
    </section>
  );
}
