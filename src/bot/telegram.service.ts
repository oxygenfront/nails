import { Injectable } from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { MyContext, StepsEnum } from './interfaces/telegram.interface';

//  695606474 Мой id
@Injectable()
export class TelegramService {

  private readonly idAdmin = 695606474;

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly prismaService: PrismaService
  ) {
  }

  async handleStart( ctx: MyContext ) {
    const telegramId = ctx.from.id;
    ctx.session.name = '';
    ctx.session.numberPhone = '';
    ctx.session.isRegistered = false;
    ctx.session.appointmentIdForEdit = '';
    ctx.session.step = null;

    const user = await this.prismaService.user.findUnique({
      where: { telegramId }
    });

    if ( user ) {
      ctx.session.isRegistered = true;
    }

    if ( !ctx.session.isRegistered && telegramId !== this.idAdmin ) {
      if ( 'callback_query' in ctx.update ) {
        return ctx.editMessageText(`Здравствуйте.\nПрежде чем записаться, Вам необходимо зарегистрироваться, нажмите кнопку ниже :)`, {
          reply_markup: {
            inline_keyboard: [ [ {
              text: 'Регистрация',
              callback_data: 'register'
            } ] ]
          }
        });
      }
      return ctx.reply(`Здравствуйте.\nПрежде чем записаться, Вам необходимо зарегистрироваться, нажмите кнопку ниже :)`, {
        reply_markup: {
          inline_keyboard: [ [ {
            text: 'Регистрация',
            callback_data: 'register'
          } ] ]
        }
      });
    }

    return this.handleProfile(ctx);
  }

  async handleText( ctx: MyContext ) {
    const telegramId = ctx.from.id;
    const text = 'message' in ctx.update && 'text' in ctx.update.message && ctx.update.message.text;
    const user = await this.prismaService.user.findUnique({ where: { telegramId } });

    if ( ctx.session.step === StepsEnum.editName ) {
      ctx.session.step = null;
      const newName = text.split('').map(( e, i ) => i === 0 ? e.toUpperCase() : e).join('');
      const updatedUser = await this.prismaService.user.update({
        where: { telegramId },
        data: {
          name: newName + ' ' + user.name.split(' ')[1]
        }
      });

      return ctx.reply(`Ваши обновленные данные:\nФИ: ${updatedUser.name}\nНомер телефона: ${updatedUser.numberPhone}`, {
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });
    }

    if ( ctx.session.step === StepsEnum.editLastName ) {
      ctx.session.step = null;
      const newLastName = text.split('').map(( e, i ) => i === 0 ? e.toUpperCase() : e).join('');

      const updatedUser = await this.prismaService.user.update({
        where: { telegramId },
        data: {
          name: user.name.split(' ')[0] + ' ' + newLastName
        }
      });
      return ctx.reply(`Ваши обновленные данные:\nФИ: ${updatedUser.name}\nНомер телефона: ${updatedUser.numberPhone}`, {
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });
    }

    if ( ctx.session.step === StepsEnum.editPhone ) {
      ctx.session.step = null;
      const updatedUser = await this.prismaService.user.update({
        where: { telegramId },
        data: { numberPhone: text }
      });
      return ctx.reply(`Ваши обновленные данные:\nФИ: ${updatedUser.name}\nНомер телефона: ${updatedUser.numberPhone}`, {
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });
    }

    if ( ctx.session.step === StepsEnum.name ) {
      if ( text.split(' ').length === 2 ) {
        ctx.session.name = text;
        ctx.session.step = StepsEnum.numberPhone;
        return ctx.reply(`Хорошо, ${ctx.session.name.split(' ')[0]}, теперь введи свой номер телефона в формате +71234567890`, {
          reply_markup: {
            inline_keyboard: [ [ { text: 'Отмена', callback_data: 'start' } ] ]
          }
        });
      }
      return ctx.reply('Введите имя и фамилию через пробел, пожалуйста', {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Отмена', callback_data: 'start' } ] ]
        }
      });
    }

    if ( ctx.session.step === StepsEnum.numberPhone ) {

      const phone = 'text' in ctx.message && ctx.message.text;
      const phoneRegex = /^\+7\d{10}$/;
      if ( !phoneRegex.test(phone) ) {
        return ctx.reply('Пожалуйста, введите номер телефона в правильном' +
          ' формате (например, +71234567890).');
      }
      ctx.session.numberPhone = phone;

      await this.prismaService.user.upsert({
        where: { numberPhone: phone },
        update: {
          telegramId,
          name: ctx.session.name
        },
        create: {
          telegramId,
          name: ctx.session.name,
          numberPhone: ctx.session.numberPhone
        }
      });

      ctx.session.numberPhone = phone;
      ctx.session.isRegistered = true;
      ctx.session.step = null;


      return ctx.reply(`Регистрация завершена!\nВаши данные: \nФИ: ${ctx.session.name}\nТелефон: ${ctx.session.numberPhone}`, {
        reply_markup: {
          inline_keyboard: [ [ {
            text: 'Записаться',
            callback_data: 'free_appointments'
          }, { text: 'Мои записи', callback_data: 'appointments' } ], [ {
            text: 'Изменить данные',
            callback_data: 'edit_user_data'
          } ] ]
        }
      });
    }

    if ( ctx.session.step === StepsEnum.addFreeSlot ) {
      const input = 'text' in ctx.message && ctx.message.text;

      const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2]) (\d{2}):(\d{2})/;

      if ( !dateRegex.test(input) ) {
        return ctx.reply('❌ Неверный формат. Введите: DD.MM HH:mm\nНапример: 10.02 14:30');
      }

      let [ day, month, hours, minutes ] = input.split(/[\.\s:]+/);
      let numberMonth = Number(month);
      let numberDay = Number(day);
      let numberHours = Number(hours);
      let numberMinutes = Number(minutes);

      let currentYear = new Date().getFullYear();
      let dateTime = new Date(currentYear, numberMonth - 1, numberDay, numberHours, numberMinutes);
      let now = new Date();

      if ( dateTime < now ) {
        if ( now.getMonth() === 11 && numberMonth <= 6 ) {
          dateTime.setFullYear(currentYear + 1);
          await ctx.reply(`⚠️ Дата уже прошла, она автоматически перенесена на следующий год: ${this.dateTimeFormatted(dateTime)}`);
        } else {
          return ctx.reply('❌ Эта дата уже прошла. Введите актуальную дату.');
        }
      }

      const existingAppointment = await this.prismaService.appointment.findFirst({
        where: {
          dateTime: dateTime
        },
        include: {
          user: true
        }
      });

      if ( existingAppointment ) {
        const user = existingAppointment.user;
        if ( existingAppointment.isBooked ) {
          return ctx.reply(`
❌ **Эта дата уже есть в базе и она находится в занятых слотах**

🗓 **Дата и время записи**: *${this.dateTimeFormatted(existingAppointment.dateTime)}*  
📞 **Номер телефона**: *${user?.numberPhone.replace(/([.!()+])/g, '\\$1')}*  
👤 **Имя клиента**: *${user?.name || 'Не указано'}*`, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [ [ {
                text: '🔙 Назад',
                callback_data: 'profile'
              } ] ]
            }
          });
        }

        return ctx.reply(`
  ✅ **Эта дата уже есть в базе и она находится в свободных слотах**
  
  🗓 **Дата и время записи**: *${this.dateTimeFormatted(existingAppointment.dateTime)}*  
  📞 **Номер телефона**: *${user?.numberPhone.replace(/([.!()+])/g, '\\$1')}*  
  👤 **Имя клиента**: *${user?.name || 'Не указано'}*`, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [ [ {
              text: '🔙 Назад',
              callback_data: 'profile'
            } ] ]
          }
        });
      }

      await this.prismaService.appointment.create({
        data: {
          dateTime,
          isBooked: false
        }
      });

      const message = `
✅ **Свободный слот успешно добавлен\\!**
🗓 **Дата и время записи**: *${this.dateTimeFormatted(dateTime)}*`;

      ctx.session.step = null;

      return ctx.reply(message, {
        parse_mode: 'MarkdownV2', reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });

    }

    if ( ctx.session.step === StepsEnum.addOccupiedSlot ) {
      const input = 'text' in ctx.message && ctx.message.text;

      const datePhoneRegex = /^(0[1-9]|[12][0-9]|3[01])\.(0[1-9]|1[0-2]) (\d{2}):(\d{2}) (\+7\d{10})$/;

      if ( !datePhoneRegex.test(input) ) {
        return ctx.reply('❌ Неверный формат. Введите: DD.MM HH:mm' +
          ' +7XXXXXXXXXX\nНапример: 10.02 14:30 +7XXXXXXXXXX');
      }

      let [ day, month, hours, minutes, phone ] = input.split(/[\.\s:]+/);
      let numberMonth = Number(month);
      let numberDay = Number(day);
      let numberHours = Number(hours);
      let numberMinutes = Number(minutes);

      let currentYear = new Date().getFullYear();
      let dateTime = new Date(currentYear, numberMonth - 1, numberDay, numberHours, numberMinutes);
      let now = new Date();

      if ( dateTime < now ) {
        if ( now.getMonth() === 11 && numberMonth <= 6 ) {
          dateTime.setFullYear(currentYear + 1);
          await ctx.reply(`⚠️ Дата уже прошла, она автоматически перенесена на следующий год: ${this.dateTimeFormatted(dateTime)}`);
        } else {
          return ctx.reply('❌ Эта дата уже прошла. Введите актуальную дату.');
        }
      }

      const existingAppointment = await this.prismaService.appointment.findFirst({
        where: {
          dateTime: dateTime
        },
        include: {
          user: true
        }
      });


      if ( existingAppointment ) {
        const user = existingAppointment.user;
        if ( existingAppointment.isBooked ) {
          return ctx.reply(`
❌ **Эта дата уже есть в базе и она находится в занятых слотах**

🗓 **Дата и время записи**: *${this.dateTimeFormatted(existingAppointment.dateTime)}*  
📞 **Номер телефона**: *${user?.numberPhone.replace(/([.!()+])/g, '\\$1')}*  
👤 **Имя клиента**: *${user?.name || 'Не указано'}*`, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [ [ {
                text: '🔙 Назад',
                callback_data: 'profile'
              } ] ]
            }
          });
        }

        return ctx.reply(`
  ✅ **Эта дата уже есть в базе и она находится в свободных слотах**
  
  🗓 **Дата и время записи**: *${this.dateTimeFormatted(existingAppointment.dateTime)}*  
  📞 **Номер телефона**: *${user?.numberPhone.replace(/([.!()+])/g, '\\$1')}*  
  👤 **Имя клиента**: *${user?.name || 'Не указано'}*`, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [ [ {
              text: '🔙 Назад',
              callback_data: 'profile'
            } ] ]
          }
        });
      }

      const isBooked = ctx.session.isBooked ?? false;

      await this.prismaService.appointment.create({
        data: {
          dateTime,
          isBooked,
          user: {
            connectOrCreate: {
              where: { numberPhone: phone },
              create: { numberPhone: phone }
            }
          }
        }
      });

      ctx.session.step = null;
      ctx.session.isBooked = null;

      const message = `
✅ **Запись успешно добавлена\\!**
🗓 **Дата и время записи**: *${this.dateTimeFormatted(dateTime)}*
📞 **Номер телефона**: *${phone.replace(/([.!()+])/g, '\\$1')}*`;


      return ctx.reply(message, {
        parse_mode: 'MarkdownV2', reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });

    }

  }

  async handleAddSlot( ctx: MyContext, isBooked: boolean ) {
    if ( ctx.from.id !== this.idAdmin ) {
      return ctx.reply('Вы не имеете доступа к этой функции.');
    }

    ctx.session.step = isBooked ? StepsEnum.addOccupiedSlot : StepsEnum.addFreeSlot;

    ctx.session.isBooked = isBooked;
    if ( ctx.session.step === StepsEnum.addFreeSlot ) {
      return ctx.editMessageText(
        `Введите дату и время для записи свободного слота: \n\nDD.MM HH:mm\n\nНапример: 10.02 14:30`, {
          reply_markup: {
            inline_keyboard: [ [ {
              text: '🔙 Назад',
              callback_data: 'profile'
            } ] ]
          }
        }
      );
    }
    return ctx.editMessageText(
      `Введите дату, время записи и номер клиента в формате: \n\nDD.MM HH:mm +7ХХХХХХХХХХ\n\nНапример: 10.02 14:30 +71234567890`, {
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      }
    );
  }

  async handleRegister( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    if ( 'data' in cb && cb.data === 'register' ) {
      ctx.session.step = StepsEnum.name;
      await ctx.editMessageText(`Пожалуйста, введите ваше имя и фамилию в формате "Имя Фамилия".`, {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Отмена', callback_data: 'start' } ] ]
        }
      });
      return;
    }
  }

  async handleProfile( ctx: MyContext ) {
    const telegramId = ctx.from.id;
    const user = await this.prismaService.user.findUnique({
      where: { telegramId }
    });

    if ( 'callback_query' in ctx.update ) {
      if ( ctx.update.callback_query.from.id === this.idAdmin ) {
        return ctx.editMessageText('Здравствуйте, Лилия. \nХорошего вам дня ❤️', {
          reply_markup: {
            inline_keyboard: [ [ {
              text: '📌 Ближайшая запись',
              callback_data: 'appointments_nearest'
            }, {
              text: '📅 Записи на сегодня',
              callback_data: 'appointments_today'
            } ], [ {
              text: '📅 Записи на неделю',
              callback_data: 'appointments_week'
            }, {
              text: '📅 Записи на месяц',
              callback_data: 'appointments_month'
            } ], [ {
              text: 'Добавить свободные слоты',
              callback_data: 'add_free_slot'
            } ], [ {
              text: 'Добавить существующие записи',
              callback_data: 'add_occupied_slot'
            } ] ]
          }
        });
      }
      return ctx.editMessageText(`Здравствуйте, ${user.name.split(' ')[0]}, данные вашего профиля:\n\nИмя: ${user.name.split(' ')[0]}\nФамилия: ${user.name.split(' ')[1]}\nНомер телефона: ${user.numberPhone}`, {
        reply_markup: {
          inline_keyboard: [ [ {
            text: 'Записаться',
            callback_data: 'free_appointments'
          }, { text: 'Мои записи', callback_data: 'appointments' } ], [ {
            text: 'Изменить данные',
            callback_data: 'edit_user_data'
          } ] ]
        }
      });
    }

    if ( 'message' in ctx.update && ctx.message.from.id === this.idAdmin ) {
      return ctx.reply('Здравствуйте, Лилия. \nХорошего вам дня ❤️', {
        reply_markup: {
          inline_keyboard: [ [ {
            text: '📌  Ближайшая запись',
            callback_data: 'appointments_nearest'
          }, {
            text: '📅  Записи на сегодня',
            callback_data: 'appointments_today'
          } ], [ {
            text: '📆  Записи на неделю',
            callback_data: 'appointments_week'
          }, {
            text: '🗓️  Записи на месяц',
            callback_data: 'appointments_month'
          } ], [ {
            text: 'Добавить свободные слоты',
            callback_data: 'add_free_slot'
          } ], [ {
            text: 'Добавить существующие записи',
            callback_data: 'add_occupied_slot'
          } ] ]
        }
      });
    }

    return ctx.reply(`Здравствуйте, ${user.name.split(' ')[0]}, данные вашего профиля:\n\nИмя: ${user.name.split(' ')[0]}\nФамилия: ${user.name.split(' ')[1]}\nНомер телефона: ${user.numberPhone}`, {
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Записаться',
          callback_data: 'free_appointments'
        }, { text: 'Мои записи', callback_data: 'appointments' } ], [ {
          text: 'Изменить данные',
          callback_data: 'edit_user_data'
        } ] ]
      }
    });
  }

  async handleNearestAppointments( ctx: MyContext ) {
    const appointment = await this.prismaService.appointment.findFirst({
      where: { isBooked: true },
      include: { user: true },
      orderBy: { dateTime: 'asc' }
    });

    if ( !appointment ) {
      return ctx.editMessageText('⏳ Нет ближайших записей.', {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

        }
      });
    }
    const phoneFormatted = appointment.user?.numberPhone.replace(/([.!()+])/g, '\\$1');

    const formattedDate = this.dateTimeFormatted(appointment.dateTime);

    return ctx.editMessageText(
      `📌 *Ближайшая запись:*\n\n📅 *Дата и время:* ${formattedDate}\n👤 *Клиент:* ${appointment.user?.name || 'Неизвестно'}\n📞 *Телефон:* ${phoneFormatted || 'Не указан'}`,
      {
        parse_mode: 'MarkdownV2', reply_markup: {
          inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]
        }
      }
    );
  }

  async handleTodayAppointments( ctx: MyContext ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const appointments = await this.prismaService.appointment.findMany({
      where: {
        isBooked: true,
        dateTime: { gte: today, lt: tomorrow }
      },
      include: { user: true },
      orderBy: { dateTime: 'asc' }
    });

    if ( appointments.length === 0 ) {
      return ctx.editMessageText('📅 Сегодня нет записей.', {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

        }
      });
    }


    const message = appointments
      .map(( a ) => `🕒 ${this.dateTimeFormatted(a.dateTime)} – ${a.user?.name || 'Неизвестный клиент'} 📞 ${a.user?.numberPhone.replace(/([.!()+])/g, '\\$1') || 'Нет телефона'}`)
      .join('\n');

    return ctx.editMessageText(`📅 *Записи на сегодня:*\n\n${message}`, { parse_mode: 'MarkdownV2' });
  }

  async handleWeekAppointments( ctx: MyContext ) {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const appointments = await this.prismaService.appointment.findMany({
      where: {
        isBooked: true,
        dateTime: { gte: today, lt: nextWeek }
      },
      include: { user: true },
      orderBy: { dateTime: 'asc' }
    });

    if ( appointments.length === 0 ) {
      return ctx.editMessageText('📆 На этой неделе нет записей.', {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

        }
      });
    }

    const message = appointments
      .map(( a ) => `📅 ${this.dateTimeFormatted(a.dateTime)} – ${a.user?.name || 'Неизвестный клиент'} 📞 ${a.user?.numberPhone.replace(/([.!()+])/g, '\\$1') || 'Нет телефона'}`)
      .join('\n');

    return ctx.editMessageText(`📆 *Записи на неделю:*\n\n${message}`, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

      }
    });
  }

  async handleMonthAppointments( ctx: MyContext ) {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);

    const appointments = await this.prismaService.appointment.findMany({
      where: {
        isBooked: true,
        dateTime: { gte: today, lt: nextMonth }
      },
      include: { user: true },
      orderBy: { dateTime: 'asc' }
    });

    if ( appointments.length === 0 ) {
      return ctx.editMessageText('📅 В этом месяце нет записей.', {
        reply_markup: {
          inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

        }
      });
    }

    const message = appointments
      .map(( a ) => `📅 ${this.dateTimeFormatted(a.dateTime)} – ${a.user?.name || 'Неизвестный клиент'} 📞 ${a.user?.numberPhone.replace(/([.!()+])/g, '\\$1') || 'Нет телефона'}`)
      .join('\n');

    return ctx.editMessageText(`📅 *Записи на месяц:*\n\n${message}`, {
      parse_mode: 'MarkdownV2', reply_markup: {
        inline_keyboard: [ [ { text: 'Назад', callback_data: 'profile' } ] ]

      }
    });
  }

  async handleEditUserData( ctx: MyContext ) {
    return ctx.editMessageText('Что вы хотите изменить ?', {
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Имя',
          callback_data: 'edit_user_name'
        }, {
          text: 'Фамилия',
          callback_data: 'edit_lastname_user'
        } ], [ {
          text: 'Номер телефона',
          callback_data: 'edit_phone_user'
        } ], [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
      }
    });
  }

  async handleEditUserName( ctx: MyContext ) {
    ctx.session.step = StepsEnum.editName;
    return ctx.editMessageText('Введите новое имя.');
  }

  async handleEditUserLastName( ctx: MyContext ) {
    ctx.session.step = StepsEnum.editLastName;
    return ctx.editMessageText('Введите новую фамилию.');
  }

  async handleEditPhoneUser( ctx: MyContext ) {
    ctx.session.step = StepsEnum.editPhone;
    return ctx.editMessageText('Введите новый номер телефона.');
  }

  async handleMyOccupiedAppointments( ctx: MyContext ) {
    const telegramId = ctx.from.id;
    const appointments = await this.prismaService.appointment.findMany({
      where: {
        user: {
          telegramId
        }
      },
      orderBy: {
        dateTime: 'asc'
      }
    });
    if ( appointments.length === 0 ) {
      return ctx.editMessageText('У вас нет записей.', {
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      });
    }

    const inlineKeyboard = appointments.map(( appointment, index ) => {
      return {
        text: this.dateTimeFormatted(appointment.dateTime, true),
        callback_data: `occupied_appointment_${appointment.id}`
      };
    });

    const groupedKeyboard = [];
    for ( let i = 0; i < inlineKeyboard.length; i += 2 ) {
      groupedKeyboard.push(inlineKeyboard.slice(i, i + 2));
    }


    return ctx.editMessageText('Мои записи:', {
      reply_markup: {
        inline_keyboard: [ ...groupedKeyboard, [ {
          text: '🔙 Назад',
          callback_data: 'profile'
        } ] ]
      }
    });

  }

  async handleFreeAppointments( ctx: MyContext ) {
    const appointments = await this.prismaService.appointment.findMany({
      where: {
        isBooked: false
      },
      orderBy: {
        dateTime: 'asc'
      }
    });
    if ( appointments.length === 0 ) {
      return ctx.editMessageText(`Сейчас нет доступных дат для записи`);
    }

    const inlineKeyboard = appointments.map(( appointment, index ) => {
      return {
        text: this.dateTimeFormatted(appointment.dateTime, true),
        callback_data: `free_appointment_${appointment.id}`
      };
    });

    const groupedKeyboard = [];
    for ( let i = 0; i < inlineKeyboard.length; i += 2 ) {
      groupedKeyboard.push(inlineKeyboard.slice(i, i + 2));
    }

    return ctx.editMessageText('Свободные слоты для записи:', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ ...groupedKeyboard, [ {
          text: '🔙 Назад',
          callback_data: 'profile'
        } ] ]
      }
    });

  }

  async handleFreeAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[2];

    const appointment = await this.prismaService.appointment.findUnique({
      where: {
        id
      }
    });


    const message = `
  ✅ **Свободный слот \\!**
  
🗓 **Дата и время слота**: *${this.dateTimeFormatted(appointment.dateTime)}*

_Для брони этого слота, нажмите кнопку ниже_`;

    return ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Забронировать слот',
          callback_data: `book_appointment_${id}`
        } ], [ { text: '🔙 Назад', callback_data: 'free_appointments' } ] ]
      }
    });
  }

  async handleOccupiedAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[2];
    ctx.session.appointmentIdForEdit = '';
    const appointment = await this.prismaService.appointment.findUnique({
      where: {
        id
      },
      include: {
        user: true
      }
    });

    const phoneFormatted = appointment.user?.numberPhone.replace(/([.!()+])/g, '\\$1');
    const userName = appointment.user?.name;

    const message = `
  ✅ **Ваша запись \\!**
  
🗓 **Дата и время записи**: *${this.dateTimeFormatted(appointment.dateTime)}*
📞 **Номер телефона**: *${phoneFormatted}*
👤 **Имя клиента**: *${userName}*

_Вы можете редактировать время для записи или удалить запись_
  `;

    return ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Редактировать запись',
          callback_data: `edit_appointment_${id}`
        } ], [ {
          text: 'Удалить запись',
          callback_data: `delete_appointment_${id}`
        } ], [ { text: '🔙 Назад', callback_data: 'appointments' } ] ]
      }
    });


  }

  async handleDeleteAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[2];
    await this.prismaService.appointment.update({
      where: { id },
      data: {
        user: { disconnect: true },
        isBooked: false
      }
    });
    return ctx.editMessageText('Запись успешно удалена', {
      reply_markup: {
        inline_keyboard: [ [ {
          text: '🔙 Назад',
          callback_data: `appointments`
        } ] ]
      }
    });

  }

  async handleEditAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[2];
    ctx.session.appointmentIdForEdit = id;
    const message = `Что вы хотите изменить в записи ?`;

    return ctx.editMessageText(message, {
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Изменить личные данные',
          callback_data: 'edit_user_data'
        } ], [ {
          text: 'Изменить время',
          callback_data: 'show_free_appointments_for_edit'
        } ], [ {
          text: '🔙 Назад',
          callback_data: `occupied_appointment_${id}`
        } ] ]
      }
    });

  }

  async handleShowFreeAppointments( ctx: MyContext ) {
    const freeAppointments = await this.prismaService.appointment.findMany({
      where: {
        isBooked: false
      },
      orderBy: {
        dateTime: 'asc'
      }
    });

    if ( freeAppointments.length === 0 ) {
      return ctx.editMessageText(`Сейчас нет доступных дат для записи`);
    }

    const inlineKeyboard = freeAppointments.map(( appointment, index ) => {
      return {
        text: this.dateTimeFormatted(appointment.dateTime, true),
        callback_data: `show_free_appointment_${appointment.id}`
      };
    });

    const groupedKeyboard = [];
    for ( let i = 0; i < inlineKeyboard.length; i += 2 ) {
      groupedKeyboard.push(inlineKeyboard.slice(i, i + 2));
    }

    return ctx.editMessageText('Свободные слоты для записи:', {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ ...groupedKeyboard, [ {
          text: '🔙 Назад',
          callback_data: `edit_appointment_${ctx.session.appointmentIdForEdit}`
        } ] ]
      }
    });
  }

  async handleShowFreeAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[3];
    const newAppointment = await this.prismaService.appointment.findUnique({
      where: {
        id
      }
    });

    const oldAppointment = await this.prismaService.appointment.findUnique({
      where: {
        id: ctx.session.appointmentIdForEdit
      }
    });

    ;

    const message = `
  ❓ **Вы уверены что хотите поменять текущее время на выбранное \\?**
    
  🗓 **Дата и время текущей записи**:  *${this.dateTimeFormatted(oldAppointment.dateTime)}*
  🗓 **Дата и время выбранного слота**: *${this.dateTimeFormatted(newAppointment.dateTime)}*

  _Для для изменения времени нажмите кнопку ниже_`;

    return ctx.editMessageText(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [ [ {
          text: 'Изменить время',
          callback_data: `change_time_appointment_${id}`
        } ], [ {
          text: '🔙 Назад',
          callback_data: 'show_free_appointments_for_edit'
        } ] ]
      }
    });

  }

  async handleChangeTimeAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[3];
    const telegramId = cb.from.id;
    await this.prismaService.appointment.update({
      where: {
        id: ctx.session.appointmentIdForEdit
      },
      data: {
        user: {
          disconnect: true
        },
        isBooked: false
      }
    });

    const newAppointment = await this.prismaService.appointment.update({
      where: {
        id
      },
      data: {
        user: {
          connect: {
            telegramId
          }
        },
        isBooked: true
      }
    });

    return ctx.editMessageText(
      `✅ *Запись успешно изменена*\n\n📅 *Новая дата и время:* ${this.dateTimeFormatted(newAppointment.dateTime)}\n\n_Если вам нужно изменить время снова, выберите другой слот\\._`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [ [ { text: '🔙 Назад', callback_data: 'profile' } ] ]
        }
      }
    );
  }

  async handleBookAppointment( ctx: MyContext ) {
    const cb = ctx.callbackQuery;
    const id = 'data' in cb && cb.data.split('_')[2];
    const telegramId = cb.from.id;


    const appointment = await this.prismaService.appointment.update({
      where: { id },
      data: {
        user: {
          connect: { telegramId: BigInt(telegramId) }
        },
        isBooked: true
      },
      include: { user: true }
    });

    return ctx.editMessageText(
      `   ✅ *Вы успешно записались\\!*\n\n
🗓  Дата и время записи: *${this.dateTimeFormatted(appointment.dateTime)}*
📞 Номер телефона: *${appointment.user.numberPhone.replace(/([.!()+])/g, '\\$1')}*
👤 Имя клиента: *${appointment.user.name}*
  
Спасибо за запись\\! Мы ждем вас в указанное время\\.\n
_Чтобы управлять своими записями, используйте кнопки ниже_\\.`,
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔙 Назад',
                callback_data: 'free_appointments'
              },
              {
                text: 'Мои записи',
                callback_data: 'appointments'
              }
            ]
          ]
        }
      }
    );
  }

  private readonly dateTimeFormatted = ( date: Date, isButton?: boolean ) => {
    if ( isButton ) {
      return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).replace(/([!()])/g, '\\$1');
    }
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(/([.!()])/g, '\\$1');
  };


}