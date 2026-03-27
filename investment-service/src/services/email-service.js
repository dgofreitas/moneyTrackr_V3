const nodemailer = require('nodemailer')
const { JsonLog } = require('json-log-middleware')
const { SERVICE_NAME } = require('../app/app-constants')

const logger = new JsonLog(SERVICE_NAME)

class EmailService {
  constructor(config = {}) {
    this.config = {
      host: config.host || process.env.SMTP_HOST,
      port: config.port || parseInt(process.env.SMTP_PORT, 10) || 587,
      user: config.user || process.env.SMTP_USER,
      pass: config.pass || process.env.SMTP_PASS,
      from: config.from || process.env.SMTP_FROM || 'noreply@moneytrackr.com',
      frontendUrl: config.frontendUrl || process.env.FRONTEND_URL || 'http://localhost:3000',
    }

    this.transporter = null
    this._initializeTransporter()
  }

  _initializeTransporter() {
    if (!this.config.host || !this.config.user || !this.config.pass) {
      logger.log('SMTP not configured, email sending will be disabled', {
        internal: { method: '_initializeTransporter', filename: 'email-service.js' },
      })
      return
    }

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.port === 465,
      auth: {
        user: this.config.user,
        pass: this.config.pass,
      },
    })
  }

  async sendResetEmail(to, resetToken) {
    if (!this.transporter) {
      logger.log('Email transporter not configured, skipping email send', {
        to,
        internal: { method: 'sendResetEmail', filename: 'email-service.js' },
      })
      // In development/test, log the reset link instead
      const resetUrl = `${this.config.frontendUrl}/reset-password?token=${resetToken}`
      logger.log('Password reset link generated', {
        to,
        resetUrl,
        internal: { method: 'sendResetEmail', filename: 'email-service.js' },
      })
      return { messageId: 'dev-mode', resetUrl }
    }

    const resetUrl = `${this.config.frontendUrl}/reset-password?token=${resetToken}`

    const mailOptions = {
      from: this.config.from,
      to,
      subject: 'MoneyTrackr - Recuperacao de Senha',
      html: this._generateResetEmailHtml(resetUrl),
      text: this._generateResetEmailText(resetUrl),
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      logger.log('Password reset email sent', {
        to,
        messageId: info.messageId,
        internal: { method: 'sendResetEmail', filename: 'email-service.js' },
      })
      return info
    } catch (error) {
      logger.error('Failed to send password reset email', error, {
        to,
        internal: { method: 'sendResetEmail', filename: 'email-service.js' },
      })
      throw error
    }
  }

  _generateResetEmailHtml(resetUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperacao de Senha - MoneyTrackr</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f9f9f9; border-radius: 10px; padding: 30px; margin-top: 20px;">
          <h1 style="color: #2c3e50; margin-bottom: 20px;">Recuperacao de Senha</h1>
          <p style="margin-bottom: 20px;">Ola,</p>
          <p style="margin-bottom: 20px;">Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: #3498db; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Redefinir Senha</a>
          </div>
          <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Este link expira em 1 hora. Se voce nao solicitou esta alteracao, pode ignorar este email.</p>
          <p style="margin-bottom: 20px; color: #666; font-size: 14px;">Se o botao nao funcionar, copie e cole este link no seu navegador:</p>
          <p style="word-break: break-all; color: #3498db; font-size: 12px;">${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">MoneyTrackr - Seu gerenciador de investimentos</p>
        </div>
      </body>
      </html>
    `
  }

  _generateResetEmailText(resetUrl) {
    return `
Recuperacao de Senha - MoneyTrackr

Ola,

Recebemos uma solicitacao para redefinir sua senha.

Para criar uma nova senha, acesse o link abaixo:
${resetUrl}

Este link expira em 1 hora. Se voce nao solicitou esta alteracao, pode ignorar este email.

MoneyTrackr - Seu gerenciador de investimentos
    `.trim()
  }

  isConfigured() {
    return this.transporter !== null
  }
}

module.exports = EmailService
