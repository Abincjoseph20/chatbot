# Generated by Django 5.2.1 on 2025-05-11 23:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chatbot', '0002_chatsession_chatmessage'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatsession',
            name='is_active',
            field=models.BooleanField(default=False),
        ),
    ]
