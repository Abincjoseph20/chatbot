from django.shortcuts import render, redirect
from django.http import JsonResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from rest_framework.decorators import api_view
from .logic.chatbot_engine import ChatbotEngine
from django.conf import settings
import os
import logging


from django.contrib.auth import login, authenticate, logout
from django.contrib import messages
from django.contrib.auth.forms import AuthenticationForm
from .forms import RegisterForm
from django.contrib.auth.decorators import login_required
from django.utils import timezone
from .models import ChatSession, ChatMessage  # We'll create these models
from django.views.decorators.http import require_GET

# Initialize logger
logger = logging.getLogger(__name__)

# Ensure media directory exists
os.makedirs(os.path.join(settings.BASE_DIR, 'media'), exist_ok=True)

# Initialize the chatbot engine
bot = ChatbotEngine()

@login_required
def home(request):
    return redirect('chat')

@login_required
def chat_view(request):
    # Initialize response variables
    response = ""
    question = ""
    active_session = None

    try:
        # Handle POST requests
        if request.method == "POST":
            # Get session ID from POST data if available
            session_id = request.POST.get("session_id")
            
            # Validate and get existing session
            if session_id:
                try:
                    active_session = ChatSession.objects.get(id=session_id, user=request.user)
                except ChatSession.DoesNotExist:
                    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                        return JsonResponse({"error": "Invalid session"}, status=400)
                    return redirect('chat')
            else:
                # Get most recent active session
                active_session = ChatSession.objects.filter(user=request.user).order_by('-updated_at').first()

            # Create new session if none exists
            if not active_session:
                active_session = ChatSession.objects.create(
                    user=request.user,
                    title=f"Chat {timezone.now().strftime('%Y-%m-%d %H:%M')}"
                )

            # Process user input
            question = request.POST.get("question", "").strip()
            document = request.FILES.get("document")
            response = ""

            # Handle file upload
            if document:
                file_path = os.path.join(settings.BASE_DIR, 'media', document.name)
                try:
                    # Save and process file
                    with open(file_path, 'wb+') as destination:
                        for chunk in document.chunks():
                            destination.write(chunk)

                    logger.info(f"File uploaded: {document.name} by {request.user.username}")

                    # Process based on file type
                    content_type = document.content_type.lower()
                    if (document.name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')) or content_type.startswith('image/')):
                        response = bot.process_image(file_path)
                    else:
                        document_content = bot.process_document(file_path)
                        enhanced_question = f"{question}\n\nDocument content:\n{document_content}" if question else f"Please analyze this document:\n{document_content}"
                        response = bot.general_query(enhanced_question)

                except Exception as e:
                    logger.error(f"Error processing file {document.name}: {str(e)}", exc_info=True)
                    response = f"Error processing file: {str(e)}"
                finally:
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            logger.error(f"Error removing temp file: {str(e)}")

            # Handle text query
            elif question:
                logger.info(f"Processing text query: {question[:100]}...")
                response = bot.general_query(question)

            # Save message to database
            if question or document:
                ChatMessage.objects.create(
                    session=active_session,
                    user_query=question or f"Uploaded file: {document.name}",
                    bot_response=response
                )

                # Update session title with first question
                if active_session.messages.count() == 1 and question:
                    active_session.title = question[:50] + ("..." if len(question) > 50 else "")
                    active_session.save()

                # Update session timestamp
                active_session.updated_at = timezone.now()
                active_session.save()

            # Handle AJAX responses
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({
                    "response": response,
                    "session_id": active_session.id,
                    "session_title": active_session.title
                })

        # Handle GET requests
        # Get or create active session
        active_session = ChatSession.objects.filter(user=request.user).order_by('-updated_at').first()
        if not active_session:
            active_session = ChatSession.objects.create(
                user=request.user,
                title=f"Chat {timezone.now().strftime('%Y-%m-%d %H:%M')}"
            )

        # Get all sessions and messages
        sessions = ChatSession.objects.filter(user=request.user).order_by('-updated_at')
        messages = active_session.messages.all().order_by('timestamp')

    except Exception as e:
        logger.error(f"Error in chat view: {str(e)}", exc_info=True)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({"error": "An error occurred"}, status=500)
        messages.error(request, "An error occurred during processing")

    return render(request, 'base.html', {
        "active_session": active_session,
        "sessions": sessions,
        "messages": messages,
        "response": response if 'response' in locals() else None,
        "question": question if 'question' in locals() else None
    })



@login_required
def new_session(request):
    new_session = ChatSession.objects.create(
        user=request.user,
        title=f"Chat {timezone.now().strftime('%Y-%m-%d %H:%M')}"
    )
    return redirect('chat')


@login_required
def load_session(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        return redirect('chat')
    except ChatSession.DoesNotExist:
        return redirect('chat')


@login_required
def delete_session(request, session_id):
    if request.method == "POST":
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            session.delete()
            return JsonResponse({"status": "success"})
        except ChatSession.DoesNotExist:
            return JsonResponse({"status": "error", "message": "Session not found"}, status=404)
    return JsonResponse({"status": "error", "message": "Invalid request"}, status=400)


# Keep your existing API views and auth views unchanged
class DocumentUploadView(APIView):
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.data.get("document")
        if not file:
            logger.warning("No file provided in DocumentUploadView")
            return Response({"error": "No file provided"}, status=400)

        file_path = os.path.join(settings.BASE_DIR, 'media', file.name)

        try:
            with open(file_path, 'wb+') as destination:
                for chunk in file.chunks():
                    destination.write(chunk)

            logger.info(f"API file upload: {file.name} by {'anonymous' if not request.user.is_authenticated else request.user.username}")

            content_type = file.content_type.lower()
            if (file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')) or content_type.startswith('image/')):
                result = bot.process_image(file_path)
            else:
                result = bot.process_document(file_path)

            return Response({"result": result})

        except Exception as e:
            logger.error(f"API error processing file {file.name}: {str(e)}", exc_info=True)
            return Response({"error": str(e)}, status=500)

        finally:
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    logger.debug(f"API temp file removed: {file_path}")
                except Exception as e:
                    logger.error(f"Error removing API temp file: {str(e)}")


@api_view(['POST'])
def debug_upload(request):
    """Endpoint for testing file uploads"""
    file = request.FILES.get('document')
    if file:
        logger.info(f"Debug upload: {file.name} by {'anonymous' if not request.user.is_authenticated else request.user.username}")
        return Response({
            'name': file.name,
            'size': file.size,
            'content_type': file.content_type,
            'received': True
        })

    logger.warning("Debug upload called with no file")
    return Response({'error': 'No file received'}, status=400)


def register_view(request):
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect("home")
    else:
        form = RegisterForm()
    
    return render(request, "authentication/register.html", {"form": form})


def login_view(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            username = form.cleaned_data.get("username")
            password = form.cleaned_data.get("password")
            user = authenticate(request, username=username, password=password)
            
            if user is not None:
                login(request, user)
                if user.is_superuser:
                    return redirect("admin_dashboard")
                return redirect("home")
            else:
                messages.error(request, "Invalid username or password")
        else:
            messages.error(request, "Invalid username or password")
    
    form = AuthenticationForm()
    return render(request, "authentication/login.html", {"form": form})

def logout_view(request):
    logout(request)
    return redirect("login")

@login_required
def get_sessions(request):
    sessions = ChatSession.objects.filter(user=request.user).order_by('-updated_at')
    sessions_data = [{
        'id': session.id,
        'title': session.title,
        'updated_at': session.updated_at.strftime('%Y-%m-%d %H:%M:%S')
    } for session in sessions]
    return JsonResponse({'sessions': sessions_data})



@login_required
def get_messages(request, session_id):
    try:
        session = ChatSession.objects.get(id=session_id, user=request.user)
        messages = ChatMessage.objects.filter(session=session).order_by('timestamp')
        messages_data = [{
            'user_query': msg.user_query,
            'bot_response': msg.bot_response,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        } for msg in messages]
        return JsonResponse({'messages': messages_data})
    except ChatSession.DoesNotExist:
        return JsonResponse({'error': 'Session not found'}, status=404)
