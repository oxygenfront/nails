import { Action, Command, Ctx, On, Start, Update } from 'nestjs-telegraf';
import { MyContext } from './interfaces/telegram.interface';
import { TelegramService } from './telegram.service';

@Update()
export class TelegramUpdate {
  constructor( private readonly telegramService: TelegramService ) {
  }

  @Start()
  async onStart( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleStart(ctx);
  }

  @Action('start')
  async handleStart( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleStart(ctx);
  }

  @On('text')
  async onMessage( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleText(ctx);
  }

  @Action('register')
  async handleCallbackQuery( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleRegister(ctx);
    await ctx.answerCbQuery();
  }

  @Action('profile')
  async handleProfile( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleProfile(ctx);
    await ctx.answerCbQuery();
  }

  @Command('profile')
  async onProfile( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleProfile(ctx);
    await ctx.answerCbQuery();
  }

  @Action('appointments_nearest')
  async handleNearestAppointments( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleNearestAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action('appointments_today')
  async handleTodayAppointments( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleTodayAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action('appointments_week')
  async handleAppointmentsWeek( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleWeekAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action('appointments_month')
  async handleAppointmentsMonth( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleMonthAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action('edit_user_data')
  async handleEditUserData( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleEditUserData(ctx);
    await ctx.answerCbQuery();
  }

  @Action('edit_user_name')
  async handleEditUserName( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleEditUserName(ctx);
    await ctx.answerCbQuery();
  }

  @Action('edit_lastname_user')
  async handleEditLastnameUser( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleEditUserLastName(ctx);
    await ctx.answerCbQuery();
  }

  @Action('edit_phone_user')
  async handleEditPhoneUser( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleEditPhoneUser(ctx);
    await ctx.answerCbQuery();
  }

  @Action('add_free_slot')
  async onAddFreeSlot( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleAddSlot(ctx, false);
    await ctx.answerCbQuery();

  }

  @Action('add_occupied_slot')
  async handleAddOccupiedSlot( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleAddSlot(ctx, true);
    await ctx.answerCbQuery();
  }

  @Action('appointments')
  async handleMyAppointments( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleMyOccupiedAppointments(ctx);
    await ctx.answerCbQuery();

  }

  @Action('free_appointments')
  async handleAddAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleFreeAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^occupied_appointment_(\d+)/)
  async handleAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleOccupiedAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^delete_appointment_(\d+)/)
  async handleDeleteAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleDeleteAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^edit_appointment_(\d+)/)
  async handleEditAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleEditAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^free_appointment_(\d+)/)
  async handleFreeAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleFreeAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^book_appointment_(\d+)/)
  async handleBookAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleBookAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action('show_free_appointments_for_edit')
  async handleShowFreeAppointmentsForEdit( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleShowFreeAppointments(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^show_free_appointment_(\d+)/)
  async handleShowFreeAppointment( ctx: MyContext ) {
    await this.telegramService.handleShowFreeAppointment(ctx);
    await ctx.answerCbQuery();
  }

  @Action(/^change_time_appointment_(\d+)/)

  async handleChangeTimeAppointment( @Ctx() ctx: MyContext ) {
    await this.telegramService.handleChangeTimeAppointment(ctx);
    await ctx.answerCbQuery();
  }
}