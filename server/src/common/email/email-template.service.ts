import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private baseTemplate: HandlebarsTemplateDelegate | null = null;
  private partialsRegistered = false;

  constructor() {
    this.logger.log('EmailTemplateService initialized - reloading partials');
    this.registerHelpers();
  }

  /**
   * Register Handlebars helpers for common operations
   */
  private registerHelpers(): void {
    // Format currency helper
    Handlebars.registerHelper('formatCurrency', (amount: string | number) => {
      const num = typeof amount === 'string' ? parseFloat(amount) : amount;
      return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    });

    // Format date helper
    Handlebars.registerHelper('formatDate', (date: Date | string) => {
      if (!date) return '';
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    });

    // Equality helper
    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Less than or equal helper
    Handlebars.registerHelper('lte', (a: number, b: number) => {
      return a <= b;
    });

    // If helper
    Handlebars.registerHelper('if', function (conditional, options) {
      if (conditional) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    // Concat helper
    Handlebars.registerHelper('concat', (...args: any[]) => {
      // Remove the options object from the end
      args.pop();
      return args.join('');
    });

    this.logger.log('Handlebars helpers registered');
  }

  /**
   * Register all partials (header, footer, button, etc.)
   */
  private async registerPartials(): Promise<void> {
    if (this.partialsRegistered) return;

    const partialsDir = path.join(__dirname, 'templates', 'partials');

    try {
      const files = await fs.readdir(partialsDir);

      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const partialName = file.replace('.hbs', '');
          const partialPath = path.join(partialsDir, file);
          const partialContent = await fs.readFile(partialPath, 'utf-8');

          Handlebars.registerPartial(partialName, partialContent);
          this.logger.log(`Registered partial: ${partialName}`);
        }
      }

      this.partialsRegistered = true;
      this.logger.log('All partials registered successfully');
    } catch (error) {
      this.logger.error('Failed to register partials:', error);
      throw error;
    }
  }

  /**
   * Load and cache the base template
   */
  private async getBaseTemplate(): Promise<HandlebarsTemplateDelegate> {
    if (this.baseTemplate) {
      return this.baseTemplate;
    }

    const basePath = path.join(__dirname, 'templates', 'base.hbs');

    try {
      const baseContent = await fs.readFile(basePath, 'utf-8');
      this.baseTemplate = Handlebars.compile(baseContent);
      this.logger.log('Base template loaded and cached');
      return this.baseTemplate;
    } catch (error) {
      this.logger.error('Failed to load base template:', error);
      throw error;
    }
  }

  /**
   * Load and cache a specific email template
   */
  private async getTemplate(
    templatePath: string
  ): Promise<HandlebarsTemplateDelegate> {
    // Check cache first
    if (this.templateCache.has(templatePath)) {
      return this.templateCache.get(templatePath)!;
    }

    const fullPath = path.join(__dirname, 'templates', `${templatePath}.hbs`);

    try {
      const templateContent = await fs.readFile(fullPath, 'utf-8');
      const template = Handlebars.compile(templateContent);

      // Cache the compiled template
      this.templateCache.set(templatePath, template);
      this.logger.log(`Template loaded and cached: ${templatePath}`);

      return template;
    } catch (error) {
      this.logger.error(`Failed to load template: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Render an email template with data
   * @param templatePath - Path to template relative to templates dir (e.g., 'auction-results/winner')
   * @param data - Data to pass to the template
   * @param subject - Email subject line
   * @returns Rendered HTML string
   */
  async render(
    templatePath: string,
    data: any,
    subject: string
  ): Promise<string> {
    try {
      // Ensure partials are registered
      await this.registerPartials();

      // Get the specific email template
      const template = await this.getTemplate(templatePath);

      // Render the template body
      const bodyHtml = template(data);

      // Get base template and wrap the body
      const baseTemplate = await this.getBaseTemplate();
      const fullHtml = baseTemplate({
        subject,
        body: bodyHtml,
      });

      this.logger.log(`Template rendered successfully: ${templatePath}`);
      return fullHtml;
    } catch (error) {
      this.logger.error(`Failed to render template: ${templatePath}`, error);
      throw error;
    }
  }

  /**
   * Clear template cache (useful for development)
   */
  clearCache(): void {
    this.templateCache.clear();
    this.baseTemplate = null;
    this.partialsRegistered = false;
    this.logger.log('Template cache cleared');
  }

  /**
   * Get subject line for a template type
   */
  getSubject(templateType: string, data: any): string {
    const subjects: Record<string, (data: any) => string> = {
      'auction-results/winner': (d) =>
        `🎉 Congratulations! You won auction ${d.auctionCode}`,
      'auction-results/non-winner': (d) => `Auction Results - ${d.auctionCode}`,
      'registration/documents-verified': (d) =>
        `✅ Documents Verified - ${d.auctionCode}`,
      'registration/deposit-payment-request': (d) =>
        `💰 Deposit Payment Required - ${d.auctionCode}`,
      'registration/deposit-confirmed': (d) =>
        `✅ Deposit Payment Confirmed - ${d.auctionCode}`,
      'registration/final-approval': (d) =>
        `🎉 Registration Approved - ${d.auctionCode}`,
      'payments/winner-payment-request': (d) =>
        `🎉 Congratulations - Payment Required - ${d.auctionCode}`,
      'payments/winner-payment-confirmed': (d) =>
        `✅ Payment Confirmed - Contract Ready - ${d.auctionCode}`,
      'payments/payment-failure': (d) => `⚠️ Payment Failed - ${d.auctionCode}`,
      'payments/payment-reminder': (d) =>
        `⏰ Payment Deadline Reminder - ${d.auctionCode}`,
      'admin/deposit-notification': (d) =>
        `🔔 New Deposit Payment Received - ${d.auctionCode}`,
      'admin/seller-payment-notification': (d) =>
        `💰 Winner Payment Received - ${d.auctionCode}`,
      'admin/winner-payment-notification': (d) =>
        `💰 Winner Payment Confirmed - ${d.auctionCode}`,
      'admin/refund-requested': (d) =>
        `📝 New Refund Request - ${d.auctionCode}`,
      'registration/refund-requested': (d) =>
        `📝 Refund Request Received - ${d.auctionCode}`,
      'registration/refund-approved': (d) =>
        `✅ Refund Approved - ${d.auctionCode}`,
      'registration/refund-rejected': (d) =>
        `❌ Refund Request Declined - ${d.auctionCode}`,
      'registration/refund-processed': (d) =>
        `💰 Refund Processed - ${d.auctionCode}`,
    };

    const subjectFn = subjects[templateType];
    if (!subjectFn) {
      this.logger.warn(`No subject defined for template: ${templateType}`);
      return 'Auction Hub Notification';
    }

    return subjectFn(data);
  }

  /**
   * List all available templates
   */
  async listTemplates(): Promise<string[]> {
    const templatesDir = path.join(__dirname, 'templates');
    const templates: string[] = [];

    const scanDir = async (dir: string, prefix = ''): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'partials') {
          await scanDir(
            path.join(dir, entry.name),
            prefix ? `${prefix}/${entry.name}` : entry.name
          );
        } else if (
          entry.isFile() &&
          entry.name.endsWith('.hbs') &&
          entry.name !== 'base.hbs'
        ) {
          const templateName = entry.name.replace('.hbs', '');
          templates.push(prefix ? `${prefix}/${templateName}` : templateName);
        }
      }
    };

    await scanDir(templatesDir);
    return templates;
  }
}
