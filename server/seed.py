from uuid import uuid4

STYLE = {'background': '#e9f0e8', 'text': '#193d31', 'button': '#193d31', 'buttonText': '#ffffff', 'option': '#ffffff', 'overlay': '#000000', 'opacity': 0.25, 'image': '', 'x': 50, 'y': 50, 'font': 'sans'}


def blank_document(name='Tu nuevo formulario'):
    return {'name': name, 'style': dict(STYLE), 'welcome': {'id': str(uuid4()), 'title': name, 'description': 'Nos gustaría conocerte un poco mejor.', 'button': 'Empezar', 'style': {}}, 'questions': [{'id': str(uuid4()), 'type': 'short', 'title': '¿Cómo te llamas?', 'description': '', 'required': True, 'next': 'next', 'style': {}}], 'results': [{'id': str(uuid4()), 'title': '¡Gracias por tu tiempo!', 'description': 'Hemos recibido tus respuestas.', 'showScore': False, 'default': True, 'min': None, 'max': None, 'style': {}}]}


def example_document():
    doc = blank_document('Tu próximo paso')
    doc['welcome'].update({'title': 'Cada gran cambio empieza con un pequeño gesto.', 'description': 'Descubre una forma de moverte que encaje contigo. Solo necesitamos un par de minutos.', 'button': 'Encontrar mi camino'})
    doc['questions'] = [
        {'id': 'interes', 'type': 'choice', 'title': '¿Qué te gustaría trabajar?', 'description': 'Elige el camino que mejor te represente.', 'required': True, 'next': 'next', 'style': {}, 'options': [
            {'id': 'fuerza', 'label': 'Sentirme más fuerte', 'points': 3, 'next': 'entrenamiento'},
            {'id': 'equilibrio', 'label': 'Encontrar mi equilibrio', 'points': 1, 'next': 'bienestar'}]},
        {'id': 'entrenamiento', 'type': 'choice', 'title': '¿Cuál es tu ritmo ahora mismo?', 'description': 'Cada punto de partida cuenta.', 'required': True, 'next': 'nombre', 'style': {'background': '#193d31', 'text': '#f5f5e9', 'button': '#d5ee9e', 'buttonText': '#193d31', 'option': '#305044'}, 'options': [
            {'id': 'inicio', 'label': 'Estoy empezando', 'points': 0, 'next': ''},
            {'id': 'regular', 'label': 'Entreno varias veces a la semana', 'points': 3, 'next': ''}]},
        {'id': 'bienestar', 'type': 'choice', 'title': '¿Qué te ayudaría a sentirte mejor?', 'description': 'Reserva un momento para ti.', 'required': True, 'next': 'nombre', 'style': {'background': '#f3e9dd'}, 'options': [
            {'id': 'pausa', 'label': 'Bajar el ritmo y respirar', 'points': 0, 'next': ''},
            {'id': 'energia', 'label': 'Moverme y tener más energía', 'points': 2, 'next': ''}]},
        {'id': 'nombre', 'type': 'short', 'title': '¿Cómo te llamas?', 'description': 'Para ponerle nombre a tu próximo paso. Puedes omitir esta pregunta.', 'required': False, 'next': 'end', 'style': {}}]
    doc['results'] = [
        {'id': 'suave', 'title': 'Tu camino empieza con calma.', 'description': 'Haz espacio para moverte, respirar y disfrutar. Los pequeños hábitos también te llevan lejos.', 'min': None, 'max': 4, 'default': False, 'showScore': True, 'style': {'background': '#f3e9dd'}},
        {'id': 'activo', 'title': 'Tienes energía para ir un paso más allá.', 'description': 'Un reto a tu medida y la constancia de cada día: esa es una buena combinación para empezar.', 'min': 4, 'max': None, 'default': False, 'showScore': True, 'style': {'background': '#193d31', 'text': '#f5f5e9', 'button': '#d5ee9e', 'buttonText': '#193d31'}}]
    return doc
