import { Injectable } from '@nestjs/common';
import { Context, Telegraf } from 'telegraf';
import * as LocalSession from 'telegraf-session-local';

@Injectable()
export class SessionMiddleware {
  static configure( bot: Telegraf<Context> ) {
    bot.use(new LocalSession({ database: 'sessions.json' }).middleware());
  }
}