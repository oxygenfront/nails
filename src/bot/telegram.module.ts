import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectBot, TelegrafModule } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { SessionMiddleware } from './middlewares/session.middleware';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

@Module({
  imports: [
    ConfigModule,
    TelegrafModule.forRootAsync({
      imports: [ ConfigModule ],
      inject: [ ConfigService ],
      useFactory: ( configService: ConfigService ) => ({
        token: configService.get<string>('TELEGRAM_TOKEN_API')
      })
    })
  ],

  providers: [ TelegramUpdate, TelegramService ]
})
export class TelegramModule {
  constructor( @InjectBot() private readonly bot: Telegraf ) {
    SessionMiddleware.configure(this.bot);
  }
}