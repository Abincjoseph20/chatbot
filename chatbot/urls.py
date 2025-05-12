# chat/urls.py
from django.urls import path
from .views import DocumentUploadView,home
from .import views

urlpatterns = [
    path("home/", home, name="home"),
    path("api/upload/", DocumentUploadView.as_view(), name="upload_api"),
    path("chat/", views.chat_view, name="chat"),  # URL for chat view

    path('new-session/', views.new_session, name='new_session'),
    path('load-session/<int:session_id>/', views.load_session, name='load_session'),
    path('delete-session/<int:session_id>/', views.delete_session, name='delete_session'),
    path('upload/', views.DocumentUploadView.as_view(), name='document_upload'),
    path('debug-upload/', views.debug_upload, name='debug_upload'),

    path('register', views.register_view, name='register'),
    path('', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    
    path('get-sessions/', views.get_sessions, name='get_sessions'),
    path('get-messages/<int:session_id>/', views.get_messages, name='get_messages'),

]